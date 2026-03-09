# qa-db-lambda-service

An AWS Lambda service that provides a simple, action-based interface to
MongoDB for QA test-automation scripts.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Supported Actions](#supported-actions)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Invoking the Lambda](#invoking-the-lambda)
- [Development](#development)

---

## Overview

Test-automation scripts often need to read seed data, insert test fixtures, or
clean up after a test run directly in MongoDB.  Instead of bundling a MongoDB
driver in every test client, this service exposes a single Lambda function that
accepts JSON events and performs the requested database operation.

---

## Architecture

```
Test script  ──►  AWS Lambda (handler.ts)  ──►  MongoDB Atlas / any MongoDB
```

The Lambda handler parses the incoming event, routes it to the correct MongoDB
operation, and returns a JSON response.  The MongoDB connection is cached
between warm invocations to minimise latency.

---

## Supported Actions

| Action        | Description                                    |
|---------------|------------------------------------------------|
| `query`       | Find documents matching an optional filter     |
| `insert`      | Insert a single document                       |
| `insertMany`  | Insert an array of documents                   |
| `update`      | Update documents matching a filter             |
| `delete`      | Delete documents matching a filter             |
| `aggregate`   | Run an aggregation pipeline                    |
| `healthcheck` | Verify the MongoDB connection                  |

### Event schema

```json
{
  "action":     "query | insert | insertMany | update | delete | aggregate | healthcheck",
  "collection": "collectionName",
  "filter":     { },
  "data":       { } | [ ],
  "update":     { "$set": { } },
  "pipeline":   [ ],
  "options":    { }
}
```

### Example – query

```json
{
  "action": "query",
  "collection": "patients",
  "filter": { "status": "active" }
}
```

Response:

```json
{
  "statusCode": 200,
  "body": "{\"documents\": [...], \"count\": 3}"
}
```

### Example – insert

```json
{
  "action": "insert",
  "collection": "patients",
  "data": { "name": "Jane Doe", "status": "active" }
}
```

### Example – healthcheck

```json
{ "action": "healthcheck" }
```

---

## Environment Variables

| Variable      | Required | Description                                |
|---------------|----------|--------------------------------------------|
| `MONGODB_URI` | ✅        | Full MongoDB connection string             |
| `DB_NAME`     | ✅        | Name of the database to connect to         |

Copy `.env.example` to `.env` and fill in your values for local development.

---

## Getting Started

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint
```

---

## Invoking the Lambda

### Direct invocation (AWS CLI)

```bash
aws lambda invoke \
  --function-name qa-db-lambda-service \
  --payload '{"action":"healthcheck"}' \
  --cli-binary-format raw-in-base64-out \
  response.json
```

### Via API Gateway

POST the event JSON as the request body:

```bash
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/prod/db \
  -H "Content-Type: application/json" \
  -d '{"action":"query","collection":"patients","filter":{"status":"active"}}'
```

---

## Development

```
src/
  db.ts       – MongoDB connection management (cached client)
  handler.ts  – Lambda entry point and action dispatcher
  types.ts    – Shared TypeScript interfaces

tests/
  db.test.ts       – Unit tests for db.ts
  handler.test.ts  – Unit tests for handler.ts
```

The TypeScript source is compiled to `dist/` by `npm run build`.  The Lambda
deployment package should include `dist/` and `node_modules/`.