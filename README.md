# Toy API Server

Sample REST API built with Fastify.

The project intentionally keeps all toy data in memory, so data is lost whenever the server restarts.

## Setup

1. Install dependencies:
   `npm install`
2. Copy environment values if needed:
   `cp .env.example .env.local`
3. Start the development server:
   `npm run dev`

## Environment

- `PORT`: port to listen on.
- `HOST`: host interface to bind.
- `CORS_ORIGINS`: comma-separated list of trusted origins.
- `LOG_LEVEL`: structured logger level used when running in production.
- `SNAPSHOT_ENABLED`: enable or disable snapshot persistence.
- `SNAPSHOT_FILE_PATH`: snapshot file path used for restore/save.
- `SNAPSHOT_INTERVAL_MS`: auto-save interval in milliseconds.

When `NODE_ENV=production`, requests with an untrusted `Origin` header are rejected.
Production also enables Fastify's structured JSON logger and returns `x-request-id` and `x-correlation-id` headers for request tracing.
Snapshot persistence restores the in-memory store on boot and flushes state again during shutdown.

## Scripts

- `npm run dev`: run with nodemon and debug logs.
- `npm run lint`: lint JavaScript files with ESLint.
- `npm run format`: format the repository with Prettier.
- `npm start`: run once with Node.js.
- `npm test`: run unit and integration tests with the Node test runner.

## Persistence

- By default, snapshots are enabled outside the test environment.
- State is written to `./data/memory-store.snapshot.json` unless overridden.
- The snapshot file contains toy records and in-memory rate-limit state.

## API notes

- `DELETE /api/toys/:id` is the only supported delete endpoint.
- `GET /healthz` returns a lightweight service health payload.
- Create and update requests enforce `likes >= 0`, a bounded name length, and an absolute image URI.
- Error responses are standardized as:

```json
{
  "error": {
    "statusCode": 404,
    "message": "Route not found"
  }
}
```

## CI

GitHub Actions runs `npm test` on every push and pull request.
