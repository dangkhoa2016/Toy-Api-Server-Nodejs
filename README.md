# Toy API Server

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

Sample REST API built with Fastify for managing toy records with short-lived in-memory storage, automatic TTL cleanup, per-IP anti-abuse controls, optional Basic Auth, and Swagger/OpenAPI documentation.

This repository is the source-of-truth Node.js implementation for the toy API behavior, validation rules, and naming conventions that are also mirrored by the [Toy-Api-Server-Cloudflare-Worker](https://github.com/dangkhoa2016/Toy-Api-Server-Cloudflare-Worker) port.

For a file-by-file comparison with the Cloudflare Worker version, see [docs/comparison-with-cloudflare-worker.md](docs/comparison-with-cloudflare-worker.md).
([Tiếng Việt](docs/comparison-with-cloudflare-worker.vi.md))

For details on the anti-abuse and rate-limiting policy, see [docs/rate-limit.md](docs/rate-limit.md).
([Tiếng Việt](docs/rate-limit.vi.md))

The project intentionally keeps all toy data in memory and expires records automatically after a short TTL.

## Frontend Integrations

This API is also used as the backend for these frontend projects:

- [Toys-UI-Javascript](https://github.com/dangkhoa2016/Toys-UI-Javascript)
- [Toys-UI-VueJs](https://github.com/dangkhoa2016/Toys-UI-VueJs)

## Setup

1. Install dependencies:
   `npm install`
2. Copy environment values if needed:
   `cp .env.example .env.local`
3. Start the development server:
   `npm run dev`

When running outside production, `bin/www` automatically loads variables from `.env.local`.

## Technologies Used

- Core runtime: `Node.js` (CommonJS modules) + `Fastify`.
- Fastify ecosystem: `@fastify/cors`, `@fastify/helmet`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-plugin`.
- Utilities: `debug`, `lodash-core`, `dotenv`.
- Developer tooling: `nodemon`, `eslint`, `@eslint/js`, `globals`, `prettier`.
- Testing and CI: Node.js built-in test runner (`node --test`) and GitHub Actions (Node 20 workflow).

## Environment

- `PORT`: port to listen on.
- `HOST`: host interface to bind.
- `CORS_ORIGINS`: comma-separated list of trusted origins.
- `LOG_LEVEL`: structured logger level; when set, it enables Fastify logging in any environment.
- `RATE_LIMIT_ENABLED`: enable or disable in-memory rate limiting.
- `RATE_LIMIT_MAX`: maximum create requests allowed per window per client IP for `POST /api/toys`.
- `DEFAULT_RATE_LIMIT_WINDOW_MINUTES`: fallback create rate-limit window in minutes used when `RATE_LIMIT_WINDOW_MS` is not set.
- `RATE_LIMIT_WINDOW_MS`: create rate-limit window length in milliseconds.
- `DEFAULT_MAX_TOYS_PER_IP`: fallback active-toy cap used when `MAX_TOYS_PER_IP` is not set.
- `MAX_TOYS_PER_IP`: maximum active toy records retained per client IP.
- `DEFAULT_SEED_MAX_TOYS_PER_IP`: fallback seed cap used when `SEED_MAX_TOYS_PER_IP` is not set.
- `SEED_MAX_TOYS_PER_IP`: temporary active-toy cap allowed while an IP is seeding its first batch.
- `DEFAULT_SEED_WINDOW_MINUTES`: fallback seed window in minutes used when `SEED_WINDOW_MS` is not set.
- `SEED_WINDOW_MS`: how long an IP keeps the temporary seeding allowance after its first successful create.
- `SECURITY_HEADERS_ENABLED`: enable or disable security headers.
- `BASIC_AUTH_ENABLED`: protect API and docs with HTTP Basic Auth.
- `BASIC_AUTH_USERNAME`: username used when basic auth is enabled.
- `BASIC_AUTH_PASSWORD`: password used when basic auth is enabled.
- `BASIC_AUTH_REALM`: optional realm sent in the `WWW-Authenticate` header.
- `DEFAULT_TOY_TTL_MINUTES`: fallback toy TTL in minutes used when `TOY_TTL_MS` is not set.
- `TOY_TTL_MS`: time-to-live for each toy record in milliseconds.
- `DEFAULT_TOY_CLEANUP_INTERVAL_MINUTES`: fallback cleanup interval in minutes used when `TOY_CLEANUP_INTERVAL_MS` is not set.
- `TOY_CLEANUP_INTERVAL_MS`: cleanup interval used by background maintenance to remove expired toys, stale rate-limit entries, and stale seed states.

When `NODE_ENV=production`, requests with an untrusted `Origin` header are rejected.
Preflight responses for trusted origins advertise `GET, POST, PUT, PATCH, DELETE, OPTIONS`, so cross-origin updates such as `PATCH /api/toys/:id/likes` are allowed when the caller origin is trusted.
Fastify's structured JSON logger is enabled whenever `LOG_LEVEL` is set, and production defaults it to `info`; responses still return `x-request-id` and `x-correlation-id` headers for request tracing.
Rate limiting is in-memory and only applies to `POST /api/toys` by default.
Responses to `POST /api/toys` include `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset`; when blocked, they also include `retry-after`.
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
- In production, Swagger UI requests still pass CORS when the docs page is served from a trusted forwarded host but the browser-origin is a local loopback proxy such as `http://localhost:8080`.

## Data Lifecycle

- State only lives in memory and is cleared when the process stops.
- Toy records expire automatically after `TOY_TTL_MS` and are removed by reads plus background cleanup.
- Background maintenance runs every `TOY_CLEANUP_INTERVAL_MS` (default: 1 minute) and also cleans stale rate-limit and seed state entries.
- A client IP can temporarily grow beyond `MAX_TOYS_PER_IP` during its first seed session, up to `SEED_MAX_TOYS_PER_IP` within `SEED_WINDOW_MS`.
- Updating a toy or its likes does not extend its existing TTL.

## Security

- Security headers are provided by Fastify Helmet.
- CORS only trusts origins listed in `CORS_ORIGINS` in production, except for the narrow `/docs` proxy case above.
- Rate limiting is enforced per client IP for `POST /api/toys` and returns `429` with `x-ratelimit-*` headers when exceeded.
- Active toy records are capped per client IP and new creates return `429` once the quota is exhausted.
- Seeding only changes the active-toy cap; it does not bypass the request rate limit for `POST /api/toys`.
- Optional basic auth protects API and Swagger endpoints with `401` + `WWW-Authenticate` when credentials are missing or invalid.

## API notes

- `DELETE /api/toys/:id` is the only supported delete endpoint.
- `GET /healthz` returns a lightweight service health payload.
- Full toy updates accept `POST`, `PUT`, or `PATCH` on `/api/toys/:id`; likes-only updates accept `POST`, `PUT`, or `PATCH` on `/api/toys/:id/likes`.
- Create and update requests enforce `likes >= 0`, a bounded name length, and an absolute image URI.
- Create requests store toys for 15 minutes by default before automatic expiry.
- The first successful creates from one IP can grow that IP up to 15 active toys by default before the normal cap of 5 resumes.
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

Update a toy with an alternative method:

```bash
curl -X POST http://localhost:8080/api/toys/1 \
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
