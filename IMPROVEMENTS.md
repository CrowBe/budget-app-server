# Suggested Improvements & Extensions

This document tracks identified gaps, modernization opportunities, and ideas for extending the budget app. Items are grouped by priority.

---

## High Priority

### 1. Password Change Endpoint
Users currently cannot change their password without direct database access. Add `PATCH /user/password` that requires the current password and accepts a new one, with re-hashing.

### 2. Refresh Tokens
JWT tokens are currently signed without expiry enforcement on the server side. Adding a refresh token mechanism (short-lived access tokens + long-lived refresh tokens stored in the database) would let users stay logged in safely without re-entering credentials frequently.

### 3. Replace `bcrypt` with `bcryptjs`
The native `bcrypt` package depends on `@mapbox/node-pre-gyp` → `tar` which has known high-severity vulnerabilities. Switching to the pure-JavaScript `bcryptjs` drop-in replacement eliminates these without any functional change:
```bash
npm uninstall bcrypt && npm install bcryptjs
# Change one require line in models/user.js: require('bcryptjs')
```

### 4. Database Connection via Environment Variable Only
The MongoDB URI is already configurable via `MONGO_URI`, but the fallback to localhost should be removed in production builds. Add a startup check:
```js
if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be set');
```

### 5. Pagination on Transaction List
The current `limit`/`offset` pagination is functional but cursor-based pagination (using `_id` or `date`) would be more efficient for large datasets and avoids the "page drift" problem when new transactions are inserted.

---

## Medium Priority

### 6. Budget / Envelope System
The core value-add of a budgeting app is tracking spending against targets. Suggested schema:
```
Budget {
  user: ObjectId,
  name: String,
  category: String,          // matches Transaction.category.primary
  limitAmount: Number,
  period: 'monthly' | 'weekly' | 'yearly',
  startDate: Date
}
```
Add `GET /budgets/status` to compare actual spending vs budget limits per category.

### 7. Recurring Transaction Detection
Many transactions (subscriptions, utilities) recur on a predictable schedule. A background job could detect patterns and flag them, helping users spot unexpected charges.

### 8. CSV / Bank Statement Import
Users would benefit from uploading a CSV export from their bank (most Australian banks support this). A `POST /transactions/import` endpoint that accepts a CSV file and maps columns to the transaction schema would dramatically lower friction.

### 9. Category Customization
Let users add, edit, or disable categorization rules at the account level rather than relying solely on the shared CSV files:
```
UserRule { user, includeRegex, excludeRegex, category, priority }
```
User rules should be evaluated before the global rules.

### 10. Search Endpoint
A `GET /transactions/search?q=coffee` endpoint backed by a MongoDB text index on `description` would let users quickly find specific transactions.

---

## Lower Priority / Nice-to-Have

### 11. Account/Wallet Model
Transactions currently float without a source account. Adding an `Account` model (bank account, credit card, investment account) enables multi-account tracking and accurate balance calculations.

### 12. Reporting Endpoints
- `GET /reports/monthly?year=2024` – monthly spending by category
- `GET /reports/trend?category=Groceries` – spending trend over time
These can be built with MongoDB aggregation pipelines.

### 13. Notifications / Alerts
Email or push notifications when:
- A budget category exceeds its limit
- An unusually large transaction is detected
- A recurring transaction is missed

### 14. OpenAPI / Swagger Documentation
Add `swagger-jsdoc` + `swagger-ui-express` to auto-generate interactive API documentation from JSDoc comments in route files.

### 15. Docker + docker-compose
A `Dockerfile` and `docker-compose.yml` (app + MongoDB) would let any developer spin up the full stack with a single command:
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
  mongo:
    image: mongo:7
    volumes: ["mongo_data:/data/db"]
```

### 16. CI/CD Pipeline
A GitHub Actions workflow (`on: push`) that runs `npm test` and optionally builds a Docker image would catch regressions before they reach production.

### 17. Structured Logging
Replace `morgan` + `console.error` with a structured logger such as `pino` or `winston`. Log entries as JSON simplify ingestion into observability platforms (Datadog, CloudWatch, etc.).

### 18. Rule File Hot-Reload
The categorization service caches rules at startup. For production deployments, expose an admin endpoint (or use a file watcher) to reload rules without restarting the server.

### 19. Rate Limiting Improvements
The current rate limiter uses in-memory storage, which does not work correctly with multiple server instances. Replace with `rate-limit-redis` to share state across instances:
```js
const RedisStore = require('rate-limit-redis');
```

### 20. TypeScript Migration
Gradually migrating to TypeScript would improve editor auto-complete, catch type errors at compile time, and make the codebase easier to contribute to. Starting with the models and services (where data shapes are well-defined) is the lowest-risk entry point.

---

## Security Checklist

- [ ] Set a strong `JWT_SECRET` (32+ random characters) before deploying
- [ ] Replace `bcrypt` with `bcryptjs` to remove the `tar` vulnerability
- [ ] Enable HTTPS / TLS termination in production (via a reverse proxy such as nginx or a load balancer)
- [ ] Add account lockout or exponential backoff after repeated failed logins
- [ ] Restrict CORS `origin` to known frontend URLs in production (`cors({ origin: process.env.ALLOWED_ORIGIN })`)
- [ ] Store refresh tokens hashed, not plaintext, if implemented
- [ ] Add a `Content-Security-Policy` header (Helmet does this but review the defaults)
