# Toy API Server

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

Sample REST API built with Fastify.

The project intentionally keeps all toy data in memory and expires records automatically after a short TTL.

## Setup

1. Install dependencies:
   `npm install`
2. Copy environment values if needed:
   `cp .env.example .env.local`
3. Start the development server:
   `npm run dev`

When running outside production, `bin/www` automatically loads variables from `.env.local`.

## Environment

- `PORT`: port to listen on.
- `HOST`: host interface to bind.
- `CORS_ORIGINS`: comma-separated list of trusted origins.
- `LOG_LEVEL`: structured logger level; when set, it enables Fastify logging in any environment.
- `RATE_LIMIT_ENABLED`: enable or disable in-memory rate limiting.
- `RATE_LIMIT_MAX`: maximum create requests allowed per window per client IP for `POST /api/toys`.
- `RATE_LIMIT_WINDOW_MS`: create rate-limit window length in milliseconds.
- `MAX_TOYS_PER_IP`: maximum active toy records retained per client IP.
- `SECURITY_HEADERS_ENABLED`: enable or disable security headers.
- `BASIC_AUTH_ENABLED`: protect API and docs with HTTP Basic Auth.
- `BASIC_AUTH_USERNAME`: username used when basic auth is enabled.
- `BASIC_AUTH_PASSWORD`: password used when basic auth is enabled.
- `BASIC_AUTH_REALM`: optional realm sent in the `WWW-Authenticate` header.
- `TOY_TTL_MS`: time-to-live for each toy record in milliseconds.
- `TOY_CLEANUP_INTERVAL_MS`: cleanup interval used to remove expired toys and stale rate-limit entries.

When `NODE_ENV=production`, requests with an untrusted `Origin` header are rejected.
Fastify's structured JSON logger is enabled whenever `LOG_LEVEL` is set, and production defaults it to `info`; responses still return `x-request-id` and `x-correlation-id` headers for request tracing.
Rate limiting is in-memory and only applies to `POST /api/toys` by default.
When basic auth is enabled, all routes except `/healthz` and favicon assets require credentials.

## Scripts

- `npm run dev`: run with nodemon and debug logs.
- `npm run lint`: lint JavaScript files with ESLint.
- `npm run lint:fix`: lint and apply safe automatic fixes.
- `npm run format`: format the repository with Prettier.
- `npm run format:check`: check formatting without changing files.
- `npm start`: run once with Node.js.
- `npm test`: run unit and integration tests with the Node test runner.

## API Docs

- Swagger UI: `/docs/`
- OpenAPI JSON: `/openapi.json`
- When basic auth is enabled, both `/docs/` and `/openapi.json` require credentials.
- When basic auth is enabled, Swagger UI shows an `Authorize` button for the shared `basicAuth` scheme.

## Data Lifecycle

- State only lives in memory and is cleared when the process stops.
- Toy records expire automatically after `TOY_TTL_MS` and are removed by reads plus background cleanup.
- Updating a toy or its likes does not extend its existing TTL.

## Security

- Security headers are provided by Fastify Helmet.
- Rate limiting is enforced per client IP for `POST /api/toys` and returns `429` with `x-ratelimit-*` headers when exceeded.
- Active toy records are capped per client IP and new creates return `429` once the quota is exhausted.
- Optional basic auth protects API and Swagger endpoints with `401` + `WWW-Authenticate` when credentials are missing or invalid.

## API notes

- `DELETE /api/toys/:id` is the only supported delete endpoint.
- `GET /healthz` returns a lightweight service health payload.
- Create and update requests enforce `likes >= 0`, a bounded name length, and an absolute image URI.
- Create requests store toys for 15 minutes by default before automatic expiry.
- Updates keep the original expiry time instead of resetting the 15-minute TTL.
- Error responses are standardized as:

```json
{
  "error": {
    "statusCode": 404,
    "message": "Route not found"
  }
}
```

## curl Examples

Start the server first:

```bash
npm run dev
```

If basic auth is enabled, add credentials to curl calls with `-u user:password`.

List toys:

```bash
curl http://localhost:8080/api/toys
```

List toys with basic auth enabled:

```bash
curl -u admin:secret http://localhost:8080/api/toys
```

Create a toy:

```bash
curl -X POST http://localhost:8080/api/toys \
   -H 'Content-Type: application/json' \
   -d '{
      "name": "Toy Robot",
      "image": "https://example.com/robot.png",
      "likes": 0
   }'
```

Get a toy by id:

```bash
curl http://localhost:8080/api/toys/1
```

Update a toy:

```bash
curl -X PUT http://localhost:8080/api/toys/1 \
   -H 'Content-Type: application/json' \
   -d '{
      "name": "Toy Boat",
      "image": "https://example.com/boat.png",
      "likes": 3
   }'
```

Update likes only:

```bash
curl -X PATCH http://localhost:8080/api/toys/1/likes \
   -H 'Content-Type: application/json' \
   -d '{"likes": 5}'
```

Delete a toy:

```bash
curl -X DELETE http://localhost:8080/api/toys/1
```

Export toys as JSON:

```bash
curl -OJ http://localhost:8080/api/toys/export
```

Fetch the OpenAPI document:

```bash
curl -u admin:secret http://localhost:8080/openapi.json
```

## CI

GitHub Actions currently installs dependencies with `yarn install --frozen-lockfile` and runs `yarn test` on every push and pull request.
