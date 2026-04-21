# Anti-abuse Policy & Rate Limiting

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](rate-limit.vi.md)

`POST /api/toys` is protected by two independent control layers to prevent abuse.

---

## Layer 1 — HTTP Rate Limit (request counter)

**Applies to:** `POST /api/toys` only, per client IP.

**How it works** (Fastify plugin in `app/middleware/rate_limit.js`, registered via `buildServer()` in `app/index.js`):

- Every `POST /api/toys` request increments a counter stored in the in-memory `MemoryStore` (`rateLimits` map) under the client IP key.
- If `count > RATE_LIMIT_MAX` within the current window → **`429 Too Many Requests`**.
- The window resets after `RATE_LIMIT_WINDOW_MS` milliseconds.

| Parameter | Default | Override via |
|---|---|---|
| Enabled | `true` (disabled in `NODE_ENV=test`) | `RATE_LIMIT_ENABLED` |
| Max requests per window | **20** | `RATE_LIMIT_MAX` |
| Window length | **5 minutes** (300,000 ms) | `RATE_LIMIT_WINDOW_MS` or `DEFAULT_RATE_LIMIT_WINDOW_MINUTES` |

**Response headers** attached to every request that passes through this layer:

```
x-ratelimit-limit:     20
x-ratelimit-remaining: 17
x-ratelimit-reset:     <unix timestamp seconds>
retry-after:           <seconds>   ← only when blocked (429)
```

**Skipped paths** (not subject to rate limiting regardless of method):

- `/healthz`
- `/favicon.ico`
- `/favicon.png`

---

## Layer 2 — Toy Quota (active toy counter)

**Applies to:** Inside `createToy()` in `app/services/toys_service.js`, evaluated after Layer 1.

Two gates are checked in order:

### Gate A — Per-IP quota (default)

- Counts active (non-expired) toys for the requesting IP in the `MemoryStore`.
- If `activeToyCount >= allowedToyLimit` → **`429`** with quota details in the response body.

| Parameter | Default | Override via |
|---|---|---|
| Per-IP toy limit | **5** | `MAX_TOYS_PER_IP` or `DEFAULT_MAX_TOYS_PER_IP` |
| Toy TTL | **15 minutes** | `TOY_TTL_MS` or `DEFAULT_TOY_TTL_MINUTES` |

### Gate B — Seed mode (temporary quota expansion)

- When an IP **creates its first toy ever**, a seed window opens.
- During the seed window: quota is raised to `SEED_MAX_TOYS_PER_IP`, and `allowedToyLimit` switches to the seed value.
- After the seed window expires: quota returns to the normal `MAX_TOYS_PER_IP`.
- Seed state is tracked in the `MemoryStore` (`seedStates` map) under the client IP key.

| Parameter | Default | Override via |
|---|---|---|
| Seed window duration | **10 minutes** | `SEED_WINDOW_MS` or `DEFAULT_SEED_WINDOW_MINUTES` |
| Expanded quota | **15 toys** | `SEED_MAX_TOYS_PER_IP` or `DEFAULT_SEED_MAX_TOYS_PER_IP` |

---

## Expired toy cleanup

Unlike Cloudflare KV (which expires entries automatically via TTL), the in-memory store requires active pruning.

- A background timer calls `pruneExpiredToys()` every `TOY_CLEANUP_INTERVAL_MS` milliseconds.
- `pruneExpiredToys()` is also called at the start of every toy-related operation (`createToy`, `getToys`, `getToy`, etc.).

| Parameter | Default | Override via |
|---|---|---|
| Cleanup interval | **1 minute** | `TOY_CLEANUP_INTERVAL_MS` or `DEFAULT_TOY_CLEANUP_INTERVAL_MINUTES` |

---

## Combined example (default config)

```
IP 1.2.3.4 starts sending POST /api/toys:

Requests 1–15:  → 201 Created   (seed window active, quota = 15)
Request 16:     → 429 Toy quota exceeded (seedMode: true, limit: 15)

── After 10 min (seed window expires) ──
(5 toys still active, TTL not yet elapsed)
Next request:   → 429 Toy quota exceeded (limit: 5)

── After 15 min (toys expire, active count = 0) ──
Next request:   → 201 Created   (normal quota = 5 resumes)

── Rate limit layer check ──
If the same IP sends 20 POST requests within 5 min (regardless of Layer 2 result):
Request 21:     → 429 (HTTP rate limit, retry-after header set)
```

---

## Key independence

- **Layer 1** counts **API calls**, including calls already rejected by Layer 2.
- **Layer 2** counts **live toys in memory** — decrements as toys pass their `expires_at` timestamp and are pruned.
- Being blocked by Layer 1 does not affect Layer 2 counters, and vice versa.

---

## Configuration reference

All parameters can be set in `.env` / `.env.example` (local) or as environment variables at deploy-time.

Each policy value has two env var forms:
- **`DEFAULT_*`** variants (minutes-based) are read once at startup by `getToyPolicyDefaults()` in `app/libs/variables.js`.
- **Direct** variants (ms-based) override the computed default at server-build time in `app/index.js`.

| Variable | Layer | Default | Purpose |
|---|---|---|---|
| `RATE_LIMIT_ENABLED` | 1 | `true` | Enable/disable HTTP rate limiting |
| `RATE_LIMIT_MAX` | 1 | `20` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | 1 | `300000` | Rate-limit window in ms (5 min) |
| `DEFAULT_RATE_LIMIT_WINDOW_MINUTES` | 1 | `5` | Rate-limit window in minutes (startup default) |
| `MAX_TOYS_PER_IP` | 2-A | `5` | Default per-IP toy quota |
| `DEFAULT_MAX_TOYS_PER_IP` | 2-A | `5` | Per-IP toy quota (startup default) |
| `TOY_TTL_MS` | 2-A/B | `900000` | How long each toy lives (15 min) |
| `DEFAULT_TOY_TTL_MINUTES` | 2-A/B | `15` | Toy TTL in minutes (startup default) |
| `SEED_WINDOW_MS` | 2-B | `600000` | Seed window duration (10 min) |
| `DEFAULT_SEED_WINDOW_MINUTES` | 2-B | `10` | Seed window in minutes (startup default) |
| `SEED_MAX_TOYS_PER_IP` | 2-B | `15` | Expanded quota during seed window |
| `DEFAULT_SEED_MAX_TOYS_PER_IP` | 2-B | `15` | Expanded seed quota (startup default) |
| `TOY_CLEANUP_INTERVAL_MS` | cleanup | `60000` | Expired-toy pruning interval (1 min) |
| `DEFAULT_TOY_CLEANUP_INTERVAL_MINUTES` | cleanup | `1` | Pruning interval in minutes (startup default) |
