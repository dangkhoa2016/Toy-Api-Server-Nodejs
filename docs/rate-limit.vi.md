# Chính sách chống lạm dụng & Rate Limiting

> 🌐 Language / Ngôn ngữ: [English](rate-limit.md) | **Tiếng Việt**

`POST /api/toys` được bảo vệ bởi hai lớp kiểm soát độc lập để ngăn chặn lạm dụng.

---

## Lớp 1 — HTTP Rate Limit (đếm số lần gọi)

**Áp dụng:** Chỉ `POST /api/toys`, theo IP của client.

**Cơ chế** (Fastify plugin trong `app/middleware/rate_limit.js`, đăng ký qua `buildServer()` trong `app/index.js`):

- Mỗi request `POST /api/toys` tăng counter lên 1, lưu trong `MemoryStore` (map `rateLimits`) theo key IP của client.
- Nếu `count > RATE_LIMIT_MAX` trong cùng một window → **`429 Too Many Requests`**.
- Window reset sau `RATE_LIMIT_WINDOW_MS` milliseconds.

| Tham số | Mặc định | Override bằng |
|---|---|---|
| Bật/tắt | `true` (tắt khi `NODE_ENV=test`) | `RATE_LIMIT_ENABLED` |
| Số request tối đa/window | **20** | `RATE_LIMIT_MAX` |
| Độ dài window | **5 phút** (300.000 ms) | `RATE_LIMIT_WINDOW_MS` hoặc `DEFAULT_RATE_LIMIT_WINDOW_MINUTES` |

**Response headers** đính kèm vào mọi request đi qua lớp này:

```
x-ratelimit-limit:     20
x-ratelimit-remaining: 17
x-ratelimit-reset:     <unix timestamp tính bằng giây>
retry-after:           <giây>   ← chỉ khi bị chặn (429)
```

**Paths bỏ qua** (không áp dụng rate limit dù method nào):

- `/healthz`
- `/favicon.ico`
- `/favicon.png`

---

## Lớp 2 — Toy Quota (đếm số toy đang active)

**Áp dụng:** Bên trong `createToy()` ở `app/services/toys_service.js`, sau khi qua Lớp 1.

Hai gate được kiểm tra theo thứ tự:

### Gate A — Per-IP quota (bình thường)

- Đếm số toy còn active (chưa hết hạn) của IP đang request trong `MemoryStore`.
- Nếu `activeToyCount >= allowedToyLimit` → **`429`** kèm thông tin chi tiết trong response body.

| Tham số | Mặc định | Override bằng |
|---|---|---|
| Quota toy mỗi IP | **5** | `MAX_TOYS_PER_IP` hoặc `DEFAULT_MAX_TOYS_PER_IP` |
| Thời gian sống của toy | **15 phút** | `TOY_TTL_MS` hoặc `DEFAULT_TOY_TTL_MINUTES` |

### Gate B — Seed mode (mở rộng quota tạm thời)

- Khi một IP **tạo toy lần đầu tiên**, seed window được kích hoạt.
- Trong seed window: quota được nâng lên `SEED_MAX_TOYS_PER_IP`, và `allowedToyLimit` chuyển sang giá trị seed.
- Sau khi seed window hết hạn: quota quay về `MAX_TOYS_PER_IP` bình thường.
- Trạng thái seed được lưu trong `MemoryStore` (map `seedStates`) theo key IP của client.

| Tham số | Mặc định | Override bằng |
|---|---|---|
| Thời lượng seed window | **10 phút** | `SEED_WINDOW_MS` hoặc `DEFAULT_SEED_WINDOW_MINUTES` |
| Quota mở rộng | **15 toy** | `SEED_MAX_TOYS_PER_IP` hoặc `DEFAULT_SEED_MAX_TOYS_PER_IP` |

---

## Dọn dẹp toy hết hạn

Khác với Cloudflare KV (tự động xóa entry khi hết TTL), in-memory store cần được dọn dẹp chủ động.

- Một background timer gọi `pruneExpiredToys()` định kỳ sau mỗi `TOY_CLEANUP_INTERVAL_MS` milliseconds.
- `pruneExpiredToys()` cũng được gọi ngay đầu mỗi thao tác liên quan đến toy (`createToy`, `getToys`, `getToy`, v.v.).

| Tham số | Mặc định | Override bằng |
|---|---|---|
| Chu kỳ dọn dẹp | **1 phút** | `TOY_CLEANUP_INTERVAL_MS` hoặc `DEFAULT_TOY_CLEANUP_INTERVAL_MINUTES` |

---

## Ví dụ tổng hợp (cấu hình mặc định)

```
IP 1.2.3.4 bắt đầu gửi POST /api/toys:

Request 1-15:  → 201 Created   (seed window mở, quota = 15)
Request 16:    → 429 Toy quota exceeded (seedMode: true, limit: 15)

── Sau 10 phút (seed window hết) ──
(vẫn còn 5 toy active, chưa hết TTL)
Request tiếp:  → 429 Toy quota exceeded (limit: 5)

── Sau 15 phút (toy hết TTL, active count = 0) ──
Request tiếp:  → 201 Created   (quota bình thường = 5 phục hồi)

── Kiểm tra lớp rate limit ──
Nếu cùng IP gửi 20 request POST trong vòng 5 phút (kết quả lớp 2 không quan trọng):
Request thứ 21: → 429 (HTTP rate limit, kèm header retry-after)
```

---

## Tính độc lập của 2 lớp

- **Lớp 1** đếm **số lần gọi API**, kể cả những request đã bị từ chối bởi Lớp 2.
- **Lớp 2** đếm **số toy đang sống trong bộ nhớ** — giảm dần khi toy vượt qua timestamp `expires_at` và bị dọn dẹp.
- Bị chặn bởi Lớp 1 không ảnh hưởng đến counter của Lớp 2, và ngược lại.

---

## Tham chiếu cấu hình

Tất cả tham số có thể cài trong `.env` / `.env.example` (local) hoặc dưới dạng biến môi trường lúc deploy.

Mỗi giá trị policy có hai dạng biến môi trường:
- Dạng **`DEFAULT_*`** (tính bằng phút) được đọc một lần khi khởi động bởi `getToyPolicyDefaults()` trong `app/libs/variables.js`.
- Dạng **trực tiếp** (tính bằng ms) ghi đè giá trị mặc định khi server được khởi tạo trong `app/index.js`.

| Biến | Lớp | Mặc định | Mục đích |
|---|---|---|---|
| `RATE_LIMIT_ENABLED` | 1 | `true` | Bật/tắt HTTP rate limiting |
| `RATE_LIMIT_MAX` | 1 | `20` | Số request tối đa mỗi window mỗi IP |
| `RATE_LIMIT_WINDOW_MS` | 1 | `300000` | Độ dài window tính bằng ms (5 phút) |
| `DEFAULT_RATE_LIMIT_WINDOW_MINUTES` | 1 | `5` | Độ dài window tính bằng phút (startup default) |
| `MAX_TOYS_PER_IP` | 2-A | `5` | Quota toy mặc định mỗi IP |
| `DEFAULT_MAX_TOYS_PER_IP` | 2-A | `5` | Quota toy mỗi IP (startup default) |
| `TOY_TTL_MS` | 2-A/B | `900000` | Thời gian sống của mỗi toy (15 phút) |
| `DEFAULT_TOY_TTL_MINUTES` | 2-A/B | `15` | TTL toy tính bằng phút (startup default) |
| `SEED_WINDOW_MS` | 2-B | `600000` | Thời lượng seed window (10 phút) |
| `DEFAULT_SEED_WINDOW_MINUTES` | 2-B | `10` | Seed window tính bằng phút (startup default) |
| `SEED_MAX_TOYS_PER_IP` | 2-B | `15` | Quota mở rộng trong seed window |
| `DEFAULT_SEED_MAX_TOYS_PER_IP` | 2-B | `15` | Quota seed mở rộng (startup default) |
| `TOY_CLEANUP_INTERVAL_MS` | cleanup | `60000` | Chu kỳ dọn dẹp toy hết hạn (1 phút) |
| `DEFAULT_TOY_CLEANUP_INTERVAL_MINUTES` | cleanup | `1` | Chu kỳ dọn dẹp tính bằng phút (startup default) |
