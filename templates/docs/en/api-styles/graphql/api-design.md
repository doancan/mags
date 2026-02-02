---
title: "{{project_name}}: API Design (GraphQL)"
version: "1.0"
status: draft
author: "{{author}}"
last_updated: "{{date}}"
tags: [architecture, api, graphql]
---

# API Design (GraphQL)

## Overview

| Component | Choice | Notes |
|-----------|--------|-------|
| Approach | Schema-first | SDL (Schema Definition Language) |
| Endpoint | `/graphql` | Single endpoint |
| Playground | `/graphql/playground` | Development only |
| Subscriptions | WebSocket | `graphql-ws` protocol |

## Schema Design

### Type Definitions

```graphql
"""Timestamps added to all persistent types."""
interface Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type {{resource_name}} implements Node {
  id: ID!
  name: String!
  description: String
  status: {{resource_name}}Status!
  createdAt: DateTime!
  updatedAt: DateTime!
  # Relationships
  owner: User!
  tags: [Tag!]!
}

enum {{resource_name}}Status {
  ACTIVE
  INACTIVE
  ARCHIVED
}

scalar DateTime
```

### Input Types

```graphql
input Create{{resource_name}}Input {
  name: String!
  description: String
  status: {{resource_name}}Status = ACTIVE
}

input Update{{resource_name}}Input {
  name: String
  description: String
  status: {{resource_name}}Status
}

input {{resource_name}}Filter {
  status: {{resource_name}}Status
  search: String
  createdAfter: DateTime
}
```

## Queries

```graphql
type Query {
  """Fetch a single resource by ID."""
  {{resource_name}}(id: ID!): {{resource_name}}

  """Fetch a paginated list of resources."""
  {{resource_name}}s(
    first: Int
    after: String
    last: Int
    before: String
    filter: {{resource_name}}Filter
    orderBy: {{resource_name}}OrderBy
  ): {{resource_name}}Connection!
}
```

## Mutations

```graphql
type Mutation {
  create{{resource_name}}(input: Create{{resource_name}}Input!): Create{{resource_name}}Payload!
  update{{resource_name}}(id: ID!, input: Update{{resource_name}}Input!): Update{{resource_name}}Payload!
  delete{{resource_name}}(id: ID!): Delete{{resource_name}}Payload!
}

type Create{{resource_name}}Payload {
  {{resource_name_lower}}: {{resource_name}}
  errors: [UserError!]!
}

type UserError {
  field: [String!]
  message: String!
  code: ErrorCode!
}

enum ErrorCode {
  NOT_FOUND
  VALIDATION_ERROR
  UNAUTHORIZED
  CONFLICT
}
```

## Subscriptions

```graphql
type Subscription {
  {{resource_name_lower}}Updated(id: ID): {{resource_name}}!
  {{resource_name_lower}}Created: {{resource_name}}!
}
```

## Pagination (Relay Cursor Style)

```graphql
type {{resource_name}}Connection {
  edges: [{{resource_name}}Edge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type {{resource_name}}Edge {
  node: {{resource_name}}!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### Cursor Encoding

Cursors are opaque base64-encoded strings:

```
base64("cursor:${id}:${sortField}:${sortValue}")
```

## Resolvers

### Resolver Map

| Type | Field | Resolver | Notes |
|------|-------|----------|-------|
| Query | `{{resource_name}}` | `{{resource_name}}Resolver.findById` | Single fetch |
| Query | `{{resource_name}}s` | `{{resource_name}}Resolver.findAll` | Paginated |
| Mutation | `create{{resource_name}}` | `{{resource_name}}Resolver.create` | Validates input |
| {{resource_name}} | `owner` | `UserResolver.batchLoad` | DataLoader |
| {{resource_name}} | `tags` | `TagResolver.batchLoad` | DataLoader |

## N+1 Problem & DataLoader

### Problem

Fetching a list of resources with relationships causes N+1 queries:
- 1 query for the list
- N queries for each relationship

### Solution: DataLoader

```
# Without DataLoader: 1 + N queries
query { users { posts { title } } }
→ SELECT * FROM users               (1 query)
→ SELECT * FROM posts WHERE user_id = 1  (N queries)
→ SELECT * FROM posts WHERE user_id = 2
→ ...

# With DataLoader: 2 queries
→ SELECT * FROM users               (1 query)
→ SELECT * FROM posts WHERE user_id IN (1, 2, ...)  (1 batched query)
```

### DataLoader Configuration

| Loader | Batches By | Max Batch Size |
|--------|-----------|----------------|
| UserLoader | `user_id` | 100 |
| TagLoader | `resource_id` | 200 |
| CommentLoader | `parent_id` | 100 |

## Error Handling

### Error Response Format

```json
{
  "data": null,
  "errors": [
    {
      "message": "Resource not found",
      "locations": [{"line": 2, "column": 3}],
      "path": ["{{resource_name_lower}}"],
      "extensions": {
        "code": "NOT_FOUND",
        "classification": "DataFetchingException"
      }
    }
  ]
}
```

### Error Classification

| Code | HTTP Equivalent | When |
|------|----------------|------|
| `GRAPHQL_PARSE_FAILED` | 400 | Malformed query |
| `GRAPHQL_VALIDATION_FAILED` | 400 | Invalid query against schema |
| `BAD_USER_INPUT` | 400 | Invalid input values |
| `UNAUTHENTICATED` | 401 | Missing/invalid auth |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected error |

## Schema Evolution

### Safe Changes (Non-Breaking)

- Adding new types
- Adding new fields to existing types
- Adding new enum values (at the end)
- Adding optional arguments to fields
- Deprecating fields with `@deprecated(reason: "...")`

### Breaking Changes (Avoid)

- Removing types or fields
- Renaming types or fields
- Changing field types
- Making nullable fields non-nullable
- Removing enum values

### Deprecation Pattern

```graphql
type User {
  name: String! @deprecated(reason: "Use firstName and lastName instead")
  firstName: String!
  lastName: String!
}
```

## Security

| Concern | Strategy |
|---------|----------|
| Query depth | Limit max depth (e.g., 10) |
| Query complexity | Assign cost per field, limit total |
| Introspection | Disable in production |
| Rate limiting | Per-operation or per-complexity |
| Authorization | Field-level directives |
| Input validation | Custom scalars + input validation |

## Performance

| Technique | Purpose |
|-----------|---------|
| DataLoader | Batch + cache DB queries |
| Persisted queries | Reduce parsing overhead |
| Query complexity analysis | Prevent expensive queries |
| Response caching | Cache common queries |
| `@defer` / `@stream` | Incremental delivery |
