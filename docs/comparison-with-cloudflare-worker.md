# Comparison: Toy-Api-Server-Nodejs vs Toy-Api-Server-Cloudflare-Worker

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](comparison-with-cloudflare-worker.vi.md)

> **Source of truth for logic:**
> [`github.com/dangkhoa2016/Toy-Api-Server-Nodejs`](https://github.com/dangkhoa2016/Toy-Api-Server-Nodejs)

> **Target runtime / port:**
> [`github.com/dangkhoa2016/Toy-Api-Server-Cloudflare-Worker`](https://github.com/dangkhoa2016/Toy-Api-Server-Cloudflare-Worker)

---

## Overview

`Toy-Api-Server-Cloudflare-Worker` is a **direct port** of `Toy-Api-Server-Nodejs`.
If you already understand the Node.js project, you already understand most of the Worker project.
The important shift is not business logic; it is the **runtime model**:

- Fastify server instance -> single Worker `fetch(request, env)` entry.
- `process.env` -> Wrangler config, `.dev.vars`, and `env` bindings.
- in-memory `MemoryStore` -> Cloudflare KV-backed stores.
- single-process assumptions -> distributed/isolate-safe behavior.

This document is written from the perspective of a **Node.js developer** who wants to get productive quickly with **Cloudflare Workers + Wrangler**.

---

## 1. Quick mental model for Node.js developers

| In the Node.js project | In the Worker project | What it means |
|---|---|---|
| `Fastify()` app instance | default export with `fetch(request, env)` | There is no `listen()` in your app code; Cloudflare invokes `fetch()` for each request. |
| `process.env.*` | `env.*` bindings + `[vars]` + `.dev.vars` | Runtime config is injected by Wrangler, not read from the Node.js process directly. |
| `bin/www` / `npm run dev` | `wrangler dev` via `node dev.js` | Local development runs inside Wrangler's Worker emulator. |
| `MemoryStore` | `KvToyStore` + `KvStateStore` | State is externalized; do not rely on per-process memory. |
| Fastify route registration | manual path matching + route modules | Routing is explicit and closer to the Fetch API than to framework DSLs. |
| Helmet / Fastify hooks | response helper layer in `src/index.js` | Common headers, CORS, auth, and rate-limit handling are composed manually. |
| background `setInterval()` cleanup | KV TTL + cleanup logic | Expiry is storage-aware; some cleanup is delegated to KV TTL instead of pure in-memory scans. |

Short version: the Worker is still the same API, but it runs in a **request-driven edge runtime** instead of a long-lived Node.js web server.

---

## 2. Directory structure mapping

| Node.js (`app/`) | Cloudflare Worker (`src/`) | Role |
|---|---|---|
| `index.js` | `index.js` | Entry point, bootstrap, request pipeline |
| `libs/variables.js` | `lib/variables.js` | Constants, policy defaults |
| `libs/cors.js` | `lib/cors.js` | CORS helpers |
| `libs/http.js` | `lib/http.js` | Error payload builder |
| `libs/request_client.js` | `lib/request_client.js` | Client key / IP extraction |
| `middleware/basic_auth.js` | `lib/auth.js` | Basic Auth logic |
| `middleware/rate_limit.js` | _(inlined in `index.js`)_ | Per-IP create rate limiting |
| `routes/home.js` | `routes/home.js` | System routes |
| `routes/errors.js` | `routes/errors.js` | `404` / `500` handlers |
| `routes/toys.js` | `routes/toys.js` | Toy CRUD routes |
| `services/toys_service.js` | `services/toys_service.js` | Domain / business logic |
| `stores/memory_store.js` | `stores/kv_toy_store.js` | Toy data access |
| _(none)_ | `stores/kv_state_store.js` | KV-backed rate-limit and seed state |

> **Note:** The Worker renames `libs/` -> `lib/` for brevity. Most other filenames intentionally stay aligned with the Node.js project.

---

## 3. Business logic stays the same

### `toys_service.js`

The validation and mutation flow is intentionally kept as close as possible to the Node.js version.

| Function | Shared behavior |
|---|---|
| `normalizeId(id)` | `Number(id)`, then `Number.isInteger` validation |
| `validateName(name)` | trim + min/max length checks + same error messages |
| `validateImage(image)` | `new URL()` + allow only `http:` / `https:` |
| `validateLikes(likes)` | integer and `>= 0` |
| `createToy`, `saveToy`, `deleteToy`, `likeToy` | Same service-level flow; Worker adds KV/global-cap/runtime safety gates |

### Policy defaults also stay aligned

```js
toyPolicyFallbacks = {
	cleanupIntervalMinutes: 1,
	maxToysPerIp:           5,
	rateLimitWindowMinutes: 5,
	seedMaxToysPerIp:       15,
	seedWindowMinutes:      10,
	toyTtlMinutes:          15,
}
```

This matters because a Node.js developer can usually trace behavior differences to **runtime/storage concerns**, not to changed product rules.

---

## 4. Shared libs and auth helpers are direct ports

### `cors.js`

The following symbols are effectively the same across both projects:

| Symbol | Status |
|---|---|
| `corsAllowedHeaders` | ✅ same |
| `corsExposedHeaders` | ✅ same |
| `corsMethods` | ✅ same |
| `parseCorsOrigins()` | ✅ same |
| `isLoopbackHostname()` | ✅ same |
| `isLoopbackOrigin()` | ✅ same |
| `parseUrl()` | ✅ same |

### `http.js`

`errorPayload()` keeps the same API contract:

```json
{
	"error": {
		"statusCode": 422,
		"message": "...",
		"details": {}
	}
}
```

### `request_client.js`

- Same primary behavior: `x-forwarded-for -> split(',')[0].trim()`
- Worker additionally checks `cf-connecting-ip` and `x-real-ip`, because Cloudflare is the network boundary

### Basic auth

- `decodeCredentials()` uses the same parsing idea
- `credentialsMatch()` keeps the same semantics
- `safeEqual()` has the same constant-time intent
	- Node.js: `crypto.timingSafeEqual`
	- Worker: XOR loop, because `node:crypto` is not available in the same way

---

## 5. Request lifecycle: Fastify vs Worker

This is the main conceptual jump for Node.js developers.

| Node.js | Worker |
|---|---|
| Build Fastify server, register plugins, then routes | Export `fetch()` and branch on method/path manually |
| Fastify decorators attach services/stores to the server | `src/index.js` constructs stores/services per request from `env` bindings |
| Hooks/plugins handle auth, CORS, rate limit, security headers | `src/index.js` composes these concerns explicitly before dispatching routes |
| Reply object shapes the response | helper functions build `Response` objects directly |

Typical request flow in the Worker:

1. Wrangler injects runtime bindings and forwards the request to `fetch(request, env)`.
2. `src/index.js` resolves env config, bindings, CORS/auth/rate-limit options, and response helpers.
3. Route modules (`src/routes/*.js`) handle matched endpoints.
4. Stores talk to KV instead of local memory.
5. A `Response` is returned directly.

If you are used to Fastify, think of the Worker entry file as a **small manual framework layer** that replaces plugin registration, hooks, and reply helpers.

---

## 6. Routes and API contract

### System routes

| Endpoint | Node.js | Worker |
|---|---|---|
| `GET /` | ✅ | ✅ |
| `GET /healthz` | ✅ | ✅ as `/health` |
| `GET /docs` | ✅ | ✅ |
| `GET /openapi.json` | ✅ | ✅ |
| `GET /404` | ✅ | ✅ |
| `GET /500` | ✅ | ✅ |
| `GET /favicon.ico` | ✅ | ✅ |
| `GET /favicon.png` | ✅ | ✅ |

### Toy routes

| Endpoint | Node.js | Worker |
|---|---|---|
| `GET /api/toys` | ✅ | ✅ |
| `GET /api/toys/export` | ✅ | ✅ |
| `POST /api/toys` | ✅ | ✅ |
| `GET /api/toys/:id` | ✅ | ✅ |
| `PATCH\|PUT\|POST /api/toys/:id` | ✅ | ✅ |
| `PATCH\|PUT\|POST /api/toys/:id/likes` | ✅ | ✅ |
| `DELETE /api/toys/:id` | ✅ | ✅ |

For most application-level work, you can treat the Worker project as having the **same REST surface** with a different runtime underneath.

---

## 7. Wrangler mental model

Wrangler is both the **local runtime tool** and the **deployment toolchain**.

| Wrangler concept | In this project | Equivalent Node.js instinct |
|---|---|---|
| `wrangler.template.toml` | committed config template | similar to committed server/deploy config |
| `.dev.vars` | local-only runtime secrets/vars | similar to `.env.local` |
| `[env.development]`, `[env.production]` | per-environment bindings and vars | similar to per-env process config |
| `wrangler dev` | local Worker runtime | similar to running dev server locally |
| `wrangler deploy` | publishes Worker to Cloudflare | similar to deploy script + hosting platform CLI |
| KV binding `TOY_STATE` | persistent storage namespace | similar to an external datastore connection |
| assets binding `ASSETS` | serves `public/` files | similar to static file hosting middleware/CDN wiring |

### Local development flow

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

What happens behind the scenes:

- `npm run dev` runs `node dev.js`
- `dev.js` reads config through Wrangler APIs
- then it launches `wrangler dev --env development --config wrangler.template.toml`

### Deployment flow

```bash
npm run deploy
```

In this repo, deployment is branch-aware:

- `main` / `master` -> production
- `staging` / `stag` -> staging, if that env is defined

For a Node.js developer, the important idea is: **Wrangler owns the runtime contract**. Your Worker code receives the world through `env`, not through a long-lived process that you boot yourself.

---

## 8. Key runtime differences you must keep in mind

| Aspect | Node.js | Cloudflare Worker |
|---|---|---|
| **Framework** | Fastify | plain Fetch API |
| **Module system** | CommonJS | ESM |
| **Execution model** | long-lived server process | request-driven isolates |
| **Storage - toys** | in-memory `MemoryStore` | Cloudflare KV |
| **Storage - state** | in-memory Maps | KV-backed state store |
| **ID generation** | sequential integer | collision-resistant random safe integer |
| **Global active toy cap** | not present | present |
| **TTL handling** | manual expiry checks | KV native TTL + payload parity |
| **Crypto** | `node:crypto` | Web Crypto + platform primitives |
| **Static assets** | app-served / inline assets | `ASSETS` binding via Wrangler |

Two practical consequences matter most:

- **Do not rely on memory surviving requests.** Persist anything important.
- **Do not assume a single process owns all state.** Design for concurrent, distributed requests.

---

## 9. KV TTL vs in-memory expiry

Node.js stores `expires_at` on the toy and checks expiry in memory.
The Worker still keeps `expires_at` in payloads for API parity, but Cloudflare KV also enforces TTL at the storage layer.

| Key prefix | Worker TTL | Node.js equivalent |
|---|---|---|
| `…:toy:<id>` | 900 s (15 min) | `toy.expires_at` |
| `…:ratelimit:<ip>` | 360 s (6 min) | rate-limit Map entry |
| `…:seed:<ip>` | 1680 s (28 min) | seed-state Map entry |

This is one of the biggest architecture differences:

- Node.js cleanup is mostly application-owned.
- Worker cleanup is partly application-owned and partly storage-owned.

---

## 10. Worker-only features to know before porting more code

- **Global active toy cap** via `maxActiveToysGlobal`
- **Collision-resistant ID allocation** to reduce cross-request and cross-isolate overwrite risk
- **KV-backed rate-limit and seed state** shared across Worker execution contexts
- **Explicit CORS preflight handling** at the entry layer
- **`x-request-id` / `x-correlation-id`** added to every response
- **Security headers** controlled by `SECURITY_HEADERS_ENABLED`
- **Static assets via Wrangler asset binding** instead of app-owned file serving

These are not random additions; they are the adjustments needed to make a Node.js-style app behave correctly in Cloudflare's runtime.

---

## 11. Practical takeaway for Node.js developers

When reading or extending the Worker codebase, use this translation rule:

- Start from the Node.js file you already understand.
- Find the same filename or same responsibility in `src/`.
- Assume business rules are the same until storage/runtime proves otherwise.
- Look in `wrangler.template.toml` and `.dev.vars` whenever a behavior depends on config or bindings.

If you keep that mapping in mind, the Worker project stops feeling like a rewrite and starts feeling like a **runtime adaptation of the same API**.
