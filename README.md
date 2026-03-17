# Budget App Server

A Node.js/Express REST API for personal budget tracking with automatic transaction categorization using regex rules derived from real bank transaction data.

## Features

- **JWT authentication** – signup, login, and protected routes
- **Automatic transaction categorization** – 2,700+ regex rules classify debit and credit transactions into categories (Groceries, Holiday, Transport, Income, etc.)
- **Transaction management** – create (single or bulk), list, filter, update, delete
- **Spending summary** – aggregated totals by category with optional date/type filters
- **Input validation** – all endpoints validate request data with descriptive error messages
- **Rate limiting** – auth endpoints are rate-limited to prevent brute-force attacks
- **Security headers** – Helmet middleware applied globally

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Setup

```bash
cp .env.example .env
# Edit .env and set JWT_SECRET, PORT, and MONGO_URI
npm install
npm run dev   # development (auto-reload)
npm start     # production
```

### Environment variables

| Variable   | Default                                    | Description                          |
|------------|--------------------------------------------|--------------------------------------|
| JWT_SECRET | *(required)*                               | Secret used to sign JWT tokens       |
| PORT       | 3000                                       | HTTP port                            |
| MONGO_URI  | mongodb://127.0.0.1:27017/budget-app       | MongoDB connection string            |

## API Reference

All protected endpoints require the header:
```
Authorization: Bearer <token>
```

### Auth

#### `POST /signup`
Create a new account.

Request body:
```json
{ "email": "alice@example.com", "password": "mypassword", "name": "Alice" }
```
Response `201`:
```json
{ "message": "Signup successful", "user": { "name": "Alice", "email": "alice@example.com" } }
```

#### `POST /login`
Authenticate and receive a JWT token.

Request body:
```json
{ "email": "alice@example.com", "password": "mypassword" }
```
Response `200`:
```json
{ "user": { "name": "Alice", "email": "alice@example.com", "token": "<jwt>" } }
```

The token expires after 7 days.

---

### User (protected)

#### `GET /user/current_user`
Returns the authenticated user's ID and email.

#### `PATCH /user/profile`
Update the authenticated user's name.

Request body: `{ "name": "New Name" }`

---

### Transactions (protected)

#### `POST /transactions`
Create a single transaction. The description is automatically categorized.

Request body:
```json
{
  "description": "WOOLWORTHS METRO SYDNEY",
  "amount": 45.50,
  "date": "2024-06-01",
  "type": "debit",
  "notes": "weekly shop"
}
```
Response `201`: `{ "transaction": { ... } }`

#### `POST /transactions/bulk`
Import multiple transactions in one request.

Request body:
```json
{
  "transactions": [
    { "description": "SALARY ACME CORP", "amount": 5000, "type": "credit", "date": "2024-06-01" },
    { "description": "NETFLIX", "amount": 17.99, "type": "debit", "date": "2024-06-02" }
  ]
}
```
Response `201`: `{ "count": 2, "transactions": [ ... ] }`

#### `GET /transactions`
List transactions with optional filters.

Query parameters:
| Param       | Description                              |
|-------------|------------------------------------------|
| type        | `debit` or `credit`                      |
| category    | Filter by primary category name          |
| startDate   | ISO 8601 date (inclusive)                |
| endDate     | ISO 8601 date (inclusive)                |
| limit       | Max results (default 50, max 200)        |
| offset      | Skip N results for pagination            |

Response `200`:
```json
{ "total": 120, "offset": 0, "limit": 50, "transactions": [ ... ] }
```

#### `GET /transactions/summary`
Spending totals grouped by primary category.

Query parameters: `type`, `startDate`, `endDate`

Response `200`:
```json
{
  "summary": [
    { "category": "Groceries", "total": 850.20, "count": 18 },
    { "category": "Transport", "total": 320.00, "count": 12 }
  ]
}
```

#### `GET /transactions/:id`
Get a single transaction by ID.

#### `PATCH /transactions/:id`
Update a transaction's fields (description, amount, date, notes, category). Manually setting a category marks `categorizedAutomatically` as `false`.

#### `DELETE /transactions/:id`
Delete a transaction.

#### `POST /transactions/:id/recategorize`
Re-run automatic categorization on an existing transaction (useful after rule updates).

---

## Transaction Categories

Transactions are categorized using two CSV rule files in `regex_rules/`:

- `consumer_debit_categories_niki.csv` – 2,700+ rules for debit/spending transactions
- `consumer_credit_categories_niki.csv` – rules for credit/income transactions

Each rule specifies:
- **Primary / Secondary / Tertiary Category** – hierarchical labels
- **Merchant Name** – the matched merchant
- **Include Regex** – regex that must match the description
- **Exclude Regex** – optional regex that must NOT match

Rules are applied in order; the first match wins.

Example categories: `Holiday`, `Groceries`, `Transport`, `Entertainment`, `Health`, `Income`, `Utilities`, `Dining`, `Shopping`, and more.

## Running Tests

```bash
npm test
```

Tests cover:
- Auth routes (signup/login validation, error cases, success paths)
- Categorization service (debit matching, credit matching, bulk categorization, unmatched fallback)

## Project Structure

```
├── app.js                          # Express app setup
├── auth/
│   └── auth.js                     # Passport strategies (signup, login, JWT)
├── models/
│   ├── user.js                     # User schema (email, password, name)
│   └── transaction.js              # Transaction schema
├── routes/
│   ├── routes.js                   # Public routes (POST /signup, POST /login)
│   ├── secure-routes.js            # User routes (GET/PATCH /user/*)
│   └── transaction-routes.js       # Transaction CRUD + categorize
├── services/
│   └── categorization.js           # Regex-based categorization engine
├── regex_rules/
│   ├── consumer_debit_categories_niki.csv
│   └── consumer_credit_categories_niki.csv
└── __tests__/
    ├── auth.test.js
    └── categorization.test.js
```
