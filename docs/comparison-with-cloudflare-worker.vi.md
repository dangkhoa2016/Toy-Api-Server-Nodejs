# So sánh: Toy-Api-Server-Nodejs vs Toy-Api-Server-Cloudflare-Worker

> 🌐 Language / Ngôn ngữ: [English](comparison-with-cloudflare-worker.md) | **Tiếng Việt**

> **Nguồn tham chiếu cho logic:**
> [`github.com/dangkhoa2016/Toy-Api-Server-Nodejs`](https://github.com/dangkhoa2016/Toy-Api-Server-Nodejs)

> **Runtime đích / bản port:**
> [`github.com/dangkhoa2016/Toy-Api-Server-Cloudflare-Worker`](https://github.com/dangkhoa2016/Toy-Api-Server-Cloudflare-Worker)

---

## Tổng quan

`Toy-Api-Server-Cloudflare-Worker` là bản **port trực tiếp** của `Toy-Api-Server-Nodejs`.
Nếu bạn đã hiểu project Node.js, thì bạn đã hiểu phần lớn project Worker.
Điểm thay đổi quan trọng không nằm ở business logic, mà nằm ở **runtime model**:

- Fastify server instance -> một entry `fetch(request, env)` duy nhất của Worker.
- `process.env` -> cấu hình Wrangler, `.dev.vars`, và `env` bindings.
- `MemoryStore` in-memory -> các store dùng Cloudflare KV.
- giả định single-process -> hành vi an toàn cho môi trường phân tán / isolate.

Tài liệu này được viết theo góc nhìn của **lập trình viên Node.js** muốn làm quen nhanh với **Cloudflare Workers + Wrangler**.

---

## 1. Mental model nhanh cho lập trình viên Node.js

| Ở project Node.js | Ở project Worker | Ý nghĩa |
|---|---|---|
| `Fastify()` app instance | default export với `fetch(request, env)` | Không có `listen()` trong code app; Cloudflare sẽ gọi `fetch()` cho từng request. |
| `process.env.*` | `env.*` bindings + `[vars]` + `.dev.vars` | Runtime config do Wrangler inject, không đọc trực tiếp từ process như Node.js thông thường. |
| `bin/www` / `npm run dev` | `wrangler dev` qua `node dev.js` | Local development chạy trong Worker runtime emulator của Wrangler. |
| `MemoryStore` | `KvToyStore` + `KvStateStore` | State được đưa ra ngoài process; không được phụ thuộc vào memory cục bộ. |
| đăng ký route bằng Fastify | match path thủ công + route modules | Routing explicit hơn, gần với Fetch API hơn framework DSL. |
| Helmet / Fastify hooks | lớp helper trong `src/index.js` | Header chung, CORS, auth, rate limit được compose thủ công. |
| background `setInterval()` cleanup | KV TTL + cleanup logic | Expiry gắn với storage, không chỉ dựa vào vòng quét in-memory. |

Tóm gọn: Worker vẫn là cùng một API, nhưng chạy trong **edge runtime theo từng request**, thay vì một web server Node.js sống lâu.

---

## 2. Ánh xạ cấu trúc thư mục

| Node.js (`app/`) | Cloudflare Worker (`src/`) | Vai trò |
|---|---|---|
| `index.js` | `index.js` | Entry point, bootstrap, request pipeline |
| `libs/variables.js` | `lib/variables.js` | Constants, policy defaults |
| `libs/cors.js` | `lib/cors.js` | CORS helpers |
| `libs/http.js` | `lib/http.js` | Error payload builder |
| `libs/request_client.js` | `lib/request_client.js` | Client key / IP extraction |
| `middleware/basic_auth.js` | `lib/auth.js` | Logic Basic Auth |
| `middleware/rate_limit.js` | _(inline trong `index.js`)_ | Rate limit create theo IP |
| `routes/home.js` | `routes/home.js` | System routes |
| `routes/errors.js` | `routes/errors.js` | `404` / `500` handlers |
| `routes/toys.js` | `routes/toys.js` | Toy CRUD routes |
| `services/toys_service.js` | `services/toys_service.js` | Domain / business logic |
| `stores/memory_store.js` | `stores/kv_toy_store.js` | Truy cập dữ liệu toy |
| _(không có)_ | `stores/kv_state_store.js` | Rate-limit và seed state trên KV |

> **Lưu ý:** Worker đổi `libs/` -> `lib/` cho ngắn gọn. Hầu hết tên file còn lại được giữ tương ứng với project Node.js.

---

## 3. Business logic vẫn giữ nguyên

### `toys_service.js`

Luồng validate và mutate được giữ gần nhất có thể với bản Node.js.

| Hàm | Hành vi dùng chung |
|---|---|
| `normalizeId(id)` | `Number(id)`, sau đó validate bằng `Number.isInteger` |
| `validateName(name)` | trim + kiểm tra min/max length + cùng error message |
| `validateImage(image)` | `new URL()` + chỉ cho phép `http:` / `https:` |
| `validateLikes(likes)` | integer và `>= 0` |
| `createToy`, `saveToy`, `deleteToy`, `likeToy` | Cùng flow ở service; Worker thêm các gate liên quan KV/global cap/runtime safety |

### Policy defaults cũng được giữ đồng bộ

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

Điều này rất quan trọng: lập trình viên Node.js có thể giả định rằng khác biệt chủ yếu đến từ **runtime/storage**, không phải do thay đổi product rule.

---

## 4. Shared libs và auth helpers là bản port trực tiếp

### `cors.js`

Các symbol sau gần như giống hệt giữa hai project:

| Symbol | Trạng thái |
|---|---|
| `corsAllowedHeaders` | ✅ giống nhau |
| `corsExposedHeaders` | ✅ giống nhau |
| `corsMethods` | ✅ giống nhau |
| `parseCorsOrigins()` | ✅ giống nhau |
| `isLoopbackHostname()` | ✅ giống nhau |
| `isLoopbackOrigin()` | ✅ giống nhau |
| `parseUrl()` | ✅ giống nhau |

### `http.js`

`errorPayload()` giữ nguyên contract:

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

- Cùng hành vi chính: `x-forwarded-for -> split(',')[0].trim()`
- Worker đọc thêm `cf-connecting-ip` và `x-real-ip`, vì Cloudflare là network boundary

### Basic auth

- `decodeCredentials()` dùng cùng ý tưởng parse
- `credentialsMatch()` giữ nguyên semantics
- `safeEqual()` giữ cùng mục tiêu so sánh constant-time
	- Node.js: `crypto.timingSafeEqual`
	- Worker: XOR loop, vì `node:crypto` không tồn tại theo cùng cách trong runtime này

---

## 5. Request lifecycle: Fastify so với Worker

Đây là bước nhảy tư duy quan trọng nhất với lập trình viên Node.js.

| Node.js | Worker |
|---|---|
| Tạo Fastify server, đăng ký plugin, rồi đăng ký routes | Export `fetch()` và tự branch theo method/path |
| Fastify decorators gắn service/store vào server | `src/index.js` khởi tạo store/service từ `env` bindings cho mỗi request |
| Hooks/plugins xử lý auth, CORS, rate limit, security headers | `src/index.js` tự compose các concern đó trước khi dispatch route |
| Reply object định hình response | helper functions tạo `Response` trực tiếp |

Luồng request điển hình trong Worker:

1. Wrangler inject runtime bindings và chuyển request vào `fetch(request, env)`.
2. `src/index.js` resolve env config, bindings, CORS/auth/rate-limit options, và response helpers.
3. Các route module (`src/routes/*.js`) xử lý endpoint phù hợp.
4. Store làm việc với KV thay vì memory cục bộ.
5. Trả về `Response` trực tiếp.

Nếu bạn quen Fastify, hãy xem file entry của Worker như một **framework layer viết tay cỡ nhỏ**, thay cho plugin registration, hooks, và reply helpers.

---

## 6. Routes và API contract

### System routes

| Endpoint | Node.js | Worker |
|---|---|---|
| `GET /` | ✅ | ✅ |
| `GET /healthz` | ✅ | ✅ dưới dạng `/health` |
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

Ở tầng ứng dụng, bạn có thể xem Worker project như **cùng một REST API** với runtime khác ở phía dưới.

---

## 7. Mental model về Wrangler

Wrangler vừa là **công cụ chạy local**, vừa là **toolchain deploy**.

| Khái niệm Wrangler | Trong project này | Bản năng tương đương ở Node.js |
|---|---|---|
| `wrangler.template.toml` | file config template được commit | gần giống config server/deploy được commit |
| `.dev.vars` | biến môi trường / secret chỉ dùng local | gần giống `.env.local` |
| `[env.development]`, `[env.production]` | vars và bindings theo môi trường | gần giống process config theo env |
| `wrangler dev` | runtime Worker local | gần giống chạy dev server local |
| `wrangler deploy` | publish Worker lên Cloudflare | gần giống deploy script + CLI của hosting platform |
| KV binding `TOY_STATE` | namespace storage bền vững | gần giống kết nối tới datastore ngoài process |
| assets binding `ASSETS` | phục vụ file trong `public/` | gần giống middleware static file / CDN wiring |

### Local development flow

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Điều gì xảy ra phía sau:

- `npm run dev` chạy `node dev.js`
- `dev.js` đọc config qua API của Wrangler
- sau đó chạy `wrangler dev --env development --config wrangler.template.toml`

### Deployment flow

```bash
npm run deploy
```

Trong repo này, deploy phụ thuộc branch:

- `main` / `master` -> production
- `staging` / `stag` -> staging, nếu env đó được khai báo

Với lập trình viên Node.js, ý chính là: **Wrangler sở hữu runtime contract**. Code Worker nhận thế giới thông qua `env`, chứ không phải qua một process sống lâu do bạn tự boot.

---

## 8. Khác biệt runtime quan trọng cần ghi nhớ

| Khía cạnh | Node.js | Cloudflare Worker |
|---|---|---|
| **Framework** | Fastify | Fetch API thuần |
| **Module system** | CommonJS | ESM |
| **Execution model** | server process sống lâu | isolate chạy theo từng request |
| **Storage - toys** | `MemoryStore` in-memory | Cloudflare KV |
| **Storage - state** | Map in-memory | state store trên KV |
| **ID generation** | integer tăng dần | random safe integer chống va chạm |
| **Global active toy cap** | không có | có |
| **TTL handling** | expiry check thủ công | KV native TTL + giữ parity trong payload |
| **Crypto** | `node:crypto` | Web Crypto + platform primitives |
| **Static assets** | app tự phục vụ / inline | `ASSETS` binding qua Wrangler |

Hai hệ quả thực tế quan trọng nhất là:

- **Không được phụ thuộc vào memory giữa các request.** Cái gì quan trọng thì phải persist.
- **Không được giả định một process duy nhất sở hữu toàn bộ state.** Hãy thiết kế cho request đồng thời và môi trường phân tán.

---

## 9. KV TTL so với in-memory expiry

Node.js lưu `expires_at` trên toy và tự kiểm tra expiry trong memory.
Worker vẫn giữ `expires_at` trong payload để đảm bảo parity API, nhưng Cloudflare KV còn enforce TTL ở storage layer.

| Key prefix | TTL của Worker | Tương đương ở Node.js |
|---|---|---|
| `…:toy:<id>` | 900 s (15 phút) | `toy.expires_at` |
| `…:ratelimit:<ip>` | 360 s (6 phút) | entry trong Map rate-limit |
| `…:seed:<ip>` | 1680 s (28 phút) | entry trong Map seed-state |

Đây là một khác biệt kiến trúc rất lớn:

- Node.js cleanup chủ yếu do application tự chịu trách nhiệm.
- Worker cleanup một phần do application xử lý, một phần do storage xử lý.

---

## 10. Các tính năng chỉ có ở Worker cần biết trước khi port thêm code

- **Global active toy cap** qua `maxActiveToysGlobal`
- **Collision-resistant ID allocation** để giảm nguy cơ overwrite giữa nhiều request / isolate
- **KV-backed rate-limit và seed state** dùng chung giữa nhiều execution context của Worker
- **Xử lý CORS preflight rõ ràng** ở entry layer
- **`x-request-id` / `x-correlation-id`** được thêm vào mọi response
- **Security headers** điều khiển bằng `SECURITY_HEADERS_ENABLED`
- **Static assets qua Wrangler asset binding** thay vì app tự phục vụ file

Đây không phải là các bổ sung ngẫu nhiên; chúng là những điều chỉnh cần thiết để một ứng dụng mang tư duy Node.js hoạt động đúng trong runtime của Cloudflare.

---

## 11. Kết luận thực dụng cho lập trình viên Node.js

Khi đọc hoặc mở rộng codebase Worker, hãy dùng quy tắc dịch này:

- Bắt đầu từ file Node.js mà bạn đã hiểu.
- Tìm file cùng tên hoặc cùng trách nhiệm trong `src/`.
- Giả định business rules vẫn giống nhau, cho đến khi storage/runtime chứng minh điều ngược lại.
- Mỗi khi hành vi phụ thuộc config hoặc bindings, hãy nhìn vào `wrangler.template.toml` và `.dev.vars`.

Giữ đúng mapping này, bạn sẽ thấy Worker project không phải là một cuộc viết lại hoàn toàn, mà là một **bản thích ứng runtime của cùng một API**.
