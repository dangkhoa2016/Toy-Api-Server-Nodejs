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

When `NODE_ENV=production`, requests with an untrusted `Origin` header are rejected.

## Scripts

- `npm run dev`: run with nodemon and debug logs.
- `npm run lint`: lint JavaScript files with ESLint.
- `npm run format`: format the repository with Prettier.
- `npm start`: run once with Node.js.
- `npm test`: run unit and integration tests with the Node test runner.

## API notes

- `DELETE /api/toys/:id` is the only supported delete endpoint.
- `GET /healthz` returns a lightweight service health payload.
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
