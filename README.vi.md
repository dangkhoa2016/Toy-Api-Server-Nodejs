# Toy API Server

> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Ví dụ REST API được xây dựng bằng Fastify.

Dự án chủ đích giữ toàn bộ dữ liệu đồ chơi trong bộ nhớ và tự động làm hết hạn record sau một khoảng TTL ngắn.

## Cài đặt

1. Cài dependency:
   `npm install`
2. Sao chép file biến môi trường nếu cần:
   `cp .env.example .env.local`
3. Khởi động server ở môi trường phát triển:
   `npm run dev`

Khi chạy ngoài môi trường production, `bin/www` sẽ tự động nạp biến từ `.env.local`.

## Biến môi trường

- `PORT`: cổng mà server sẽ lắng nghe.
- `HOST`: địa chỉ host để bind server.
- `CORS_ORIGINS`: danh sách origin tin cậy, ngăn cách bằng dấu phẩy.
- `LOG_LEVEL`: mức structured logger; khi được set thì Fastify logger sẽ bật ở mọi môi trường.
- `RATE_LIMIT_ENABLED`: bật hoặc tắt rate limiting in-memory.
- `RATE_LIMIT_MAX`: số request tạo mới tối đa cho mỗi IP client trong một cửa sổ thời gian trên `POST /api/toys`.
- `DEFAULT_RATE_LIMIT_WINDOW_MINUTES`: cửa sổ rate limiting mặc định tính theo phút khi chưa set `RATE_LIMIT_WINDOW_MS`.
- `RATE_LIMIT_WINDOW_MS`: độ dài cửa sổ rate limiting cho create request tính bằng mili giây.
- `DEFAULT_MAX_TOYS_PER_IP`: active-toy cap mặc định dùng khi chưa set `MAX_TOYS_PER_IP`.
- `MAX_TOYS_PER_IP`: số toy record còn hiệu lực tối đa được giữ lại cho mỗi IP client.
- `DEFAULT_SEED_MAX_TOYS_PER_IP`: seed cap mặc định dùng khi chưa set `SEED_MAX_TOYS_PER_IP`.
- `SEED_MAX_TOYS_PER_IP`: ngưỡng toy record còn hiệu lực tạm thời được phép dùng khi một IP đang seed lô dữ liệu đầu tiên.
- `DEFAULT_SEED_WINDOW_MINUTES`: seed window mặc định tính theo phút khi chưa set `SEED_WINDOW_MS`.
- `SEED_WINDOW_MS`: khoảng thời gian một IP còn giữ seed allowance kể từ lần create thành công đầu tiên.
- `SECURITY_HEADERS_ENABLED`: bật hoặc tắt security headers.
- `BASIC_AUTH_ENABLED`: bảo vệ API và tài liệu bằng HTTP Basic Auth.
- `BASIC_AUTH_USERNAME`: tên người dùng khi bật basic auth.
- `BASIC_AUTH_PASSWORD`: mật khẩu khi bật basic auth.
- `BASIC_AUTH_REALM`: realm tuỳ chọn được trả về trong header `WWW-Authenticate`.
- `DEFAULT_TOY_TTL_MINUTES`: TTL mặc định của toy record tính theo phút khi chưa set `TOY_TTL_MS`.
- `TOY_TTL_MS`: thời gian sống của mỗi toy record tính bằng mili giây.
- `DEFAULT_TOY_CLEANUP_INTERVAL_MINUTES`: chu kỳ cleanup mặc định tính theo phút khi chưa set `TOY_CLEANUP_INTERVAL_MS`.
- `TOY_CLEANUP_INTERVAL_MS`: chu kỳ dọn record hết hạn và state rate limit cũ.

Khi `NODE_ENV=production`, các request có header `Origin` không đáng tin cậy sẽ bị từ chối.
Structured JSON logger của Fastify sẽ bật khi `LOG_LEVEL` được set, và trong production mặc định dùng mức `info`; response vẫn trả về header `x-request-id` cùng `x-correlation-id` để truy vết request.
Rate limiting được lưu in-memory và mặc định chỉ áp dụng cho `POST /api/toys`.
Khi bật basic auth, tất cả route ngoại trừ `/healthz` và các asset favicon sẽ yêu cầu credentials.

## Scripts

- `npm run dev`: chạy bằng nodemon với debug logs.
- `npm run lint`: lint các file JavaScript bằng ESLint.
- `npm run lint:fix`: lint và tự động áp dụng các chỉnh sửa an toàn.
- `npm run format`: format toàn bộ repo bằng Prettier.
- `npm run format:check`: kiểm tra format mà không sửa file.
- `npm start`: chạy server một lần bằng Node.js.
- `npm test`: chạy unit test và integration test bằng Node test runner.

## Tài liệu API

- Swagger UI: `/docs/`
- OpenAPI JSON: `/openapi.json`
- Khi bật basic auth, cả `/docs/` và `/openapi.json` đều yêu cầu credentials.
- Khi bật basic auth, Swagger UI sẽ hiển thị nút `Authorize` cho security scheme `basicAuth` dùng chung.

## Vòng đời dữ liệu

- State chỉ tồn tại trong memory và sẽ mất khi process dừng.
- Toy record tự hết hạn theo `TOY_TTL_MS` và được dọn bởi luồng đọc cùng background cleanup.
- Một IP client có thể tạm thời vượt `MAX_TOYS_PER_IP` trong giai đoạn seed ban đầu, tối đa tới `SEED_MAX_TOYS_PER_IP` trong `SEED_WINDOW_MS`.
- Việc update toy hoặc likes không gia hạn TTL hiện có của record đó.

## Bảo mật

- Security headers được cung cấp bởi Fastify Helmet.
- Rate limiting được áp dụng theo IP client cho `POST /api/toys` và trả về `429` kèm các header `x-ratelimit-*` khi vượt ngưỡng.
- Số toy record còn hiệu lực cũng bị giới hạn theo IP client; create mới sẽ trả `429` khi chạm quota.
- Seed mode chỉ nới active-toy cap, không bỏ qua request rate limit của `POST /api/toys`.
- Basic auth tuỳ chọn sẽ bảo vệ API và Swagger endpoints bằng `401` + `WWW-Authenticate` khi thiếu hoặc sai credentials.

## Ghi chú về API

- `DELETE /api/toys/:id` là endpoint xoá duy nhất được hỗ trợ.
- `GET /healthz` trả về payload health check nhẹ.
- Request create và update yêu cầu `likes >= 0`, giới hạn độ dài tên, và `image` phải là URI tuyệt đối.
- Record tạo mới mặc định chỉ tồn tại 15 phút trước khi tự hết hạn.
- Các create thành công đầu tiên từ một IP có thể nâng giới hạn IP đó lên 15 active toy theo mặc định trước khi quay lại ngưỡng thường là 5.
- Các lần update vẫn giữ nguyên thời điểm hết hạn ban đầu, không reset lại TTL 15 phút.
- Response lỗi được chuẩn hoá theo dạng:

```json
{
  "error": {
    "statusCode": 404,
    "message": "Route not found"
  }
}
```

## Ví dụ curl

Hãy khởi động server trước:

```bash
npm run dev
```

Nếu basic auth được bật, hãy thêm credentials vào lệnh curl bằng `-u user:password`.

Liệt kê toys:

```bash
curl http://localhost:8080/api/toys
```

Liệt kê toys khi bật basic auth:

```bash
curl -u admin:secret http://localhost:8080/api/toys
```

Tạo một toy:

```bash
curl -X POST http://localhost:8080/api/toys \
   -H 'Content-Type: application/json' \
   -d '{
      "name": "Toy Robot",
      "image": "https://example.com/robot.png",
      "likes": 0
   }'
```

Lấy toy theo id:

```bash
curl http://localhost:8080/api/toys/1
```

Cập nhật một toy:

```bash
curl -X PUT http://localhost:8080/api/toys/1 \
   -H 'Content-Type: application/json' \
   -d '{
      "name": "Toy Boat",
      "image": "https://example.com/boat.png",
      "likes": 3
   }'
```

Cập nhật riêng số likes:

```bash
curl -X PATCH http://localhost:8080/api/toys/1/likes \
   -H 'Content-Type: application/json' \
   -d '{"likes": 5}'
```

Xoá một toy:

```bash
curl -X DELETE http://localhost:8080/api/toys/1
```

Xuất toys ra file JSON:

```bash
curl -OJ http://localhost:8080/api/toys/export
```

Lấy tài liệu OpenAPI:

```bash
curl -u admin:secret http://localhost:8080/openapi.json
```

## CI

GitHub Actions hiện cài dependency bằng `yarn install --frozen-lockfile` và chạy `yarn test` trên mỗi lần push và pull request.