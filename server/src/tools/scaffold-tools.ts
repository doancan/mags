// ============================================
// MAGS — Scaffold Tools
// MCP tool handlers for module doc scaffolding
// ============================================

import { z } from "zod";
import type { ScaffoldFile } from "../types/index.js";

export function registerScaffoldTools(server: any) {
  // --- mags_scaffold_module ---
  server.tool(
    "mags_scaffold_module",
    "Generate documentation scaffolds when a new module is added to the project. Creates PRD section, data model draft, API endpoint draft, and project structure outline.",
    {
      module: z.string().describe("Module name (e.g., 'payments', 'analytics')"),
      description: z.string().describe("Brief description of the module"),
      type: z
        .enum(["backend", "frontend", "fullstack"])
        .nullable()
        .optional()
        .describe("Module type (default: fullstack)"),
      apiStyle: z
        .enum(["rest", "graphql", "grpc", "event-driven"])
        .nullable()
        .optional()
        .describe("API style (default: rest)"),
    },
    async ({
      module,
      description,
      type,
      apiStyle,
    }: {
      module: string;
      description: string;
      type?: "backend" | "frontend" | "fullstack" | null;
      apiStyle?: "rest" | "graphql" | "grpc" | "event-driven" | null;
    }) => {
      const moduleType = type || "fullstack";
      const style = apiStyle || "rest";
      const files: ScaffoldFile[] = [];

      // PRD section scaffold
      files.push({
        path: `prd-${module}-section.md`,
        content: `## M-NEW: ${capitalize(module)}

> ${description}

### Features

| ID | Feature | Description | Priority |
|---|---|---|---|
| ${module.toUpperCase()}-001 | | | P0 |
| ${module.toUpperCase()}-002 | | | P1 |
| ${module.toUpperCase()}-003 | | | P2 |

### Acceptance Criteria

- [ ]
- [ ]
- [ ]
`,
      });

      // Data model scaffold
      if (moduleType === "backend" || moduleType === "fullstack") {
        files.push({
          path: `data-model-${module}-section.md`,
          content: `## ${capitalize(module)} Tables

### ${module}

| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenant.id |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

**Indexes:**
- \`idx_${module}_tenant\`: (tenant_id, created_at DESC)
`,
        });
      }

      // API endpoints scaffold — varies by style
      if (moduleType === "backend" || moduleType === "fullstack") {
        switch (style) {
          case "graphql":
            files.push({
              path: `api-${module}-section.md`,
              content: `### ${capitalize(module)} (GraphQL)

\`\`\`graphql
type ${capitalize(module)} {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input Create${capitalize(module)}Input {
  # Add fields
}

input Update${capitalize(module)}Input {
  # Add fields
}

type Query {
  ${module}(id: ID!): ${capitalize(module)}
  ${module}s(first: Int, after: String): ${capitalize(module)}Connection!
}

type Mutation {
  create${capitalize(module)}(input: Create${capitalize(module)}Input!): ${capitalize(module)}!
  update${capitalize(module)}(id: ID!, input: Update${capitalize(module)}Input!): ${capitalize(module)}!
  delete${capitalize(module)}(id: ID!): Boolean!
}

type ${capitalize(module)}Connection {
  edges: [${capitalize(module)}Edge!]!
  pageInfo: PageInfo!
}

type ${capitalize(module)}Edge {
  node: ${capitalize(module)}!
  cursor: String!
}
\`\`\`
`,
            });
            break;

          case "grpc":
            files.push({
              path: `api-${module}-section.md`,
              content: `### ${capitalize(module)} (gRPC)

\`\`\`protobuf
syntax = "proto3";

package ${module}.v1;

service ${capitalize(module)}Service {
  rpc Get${capitalize(module)} (Get${capitalize(module)}Request) returns (${capitalize(module)});
  rpc List${capitalize(module)}s (List${capitalize(module)}sRequest) returns (List${capitalize(module)}sResponse);
  rpc Create${capitalize(module)} (Create${capitalize(module)}Request) returns (${capitalize(module)});
  rpc Update${capitalize(module)} (Update${capitalize(module)}Request) returns (${capitalize(module)});
  rpc Delete${capitalize(module)} (Delete${capitalize(module)}Request) returns (google.protobuf.Empty);
}

message ${capitalize(module)} {
  string id = 1;
  google.protobuf.Timestamp created_at = 2;
  google.protobuf.Timestamp updated_at = 3;
}

message Get${capitalize(module)}Request {
  string id = 1;
}

message List${capitalize(module)}sRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message List${capitalize(module)}sResponse {
  repeated ${capitalize(module)} ${module}s = 1;
  string next_page_token = 2;
}

message Create${capitalize(module)}Request {
  // Add fields
}

message Update${capitalize(module)}Request {
  string id = 1;
  // Add fields
}

message Delete${capitalize(module)}Request {
  string id = 1;
}
\`\`\`
`,
            });
            break;

          case "event-driven":
            files.push({
              path: `api-${module}-section.md`,
              content: `### ${capitalize(module)} (Event-Driven)

#### Events

| Event | Producer | Consumer | Schema |
|---|---|---|---|
| ${module}.created | ${module}-service | notification-service | ${capitalize(module)}CreatedEvent |
| ${module}.updated | ${module}-service | search-service | ${capitalize(module)}UpdatedEvent |
| ${module}.deleted | ${module}-service | cleanup-service | ${capitalize(module)}DeletedEvent |

#### Event Schemas

\`\`\`json
{
  "specversion": "1.0",
  "type": "${module}.created",
  "source": "${module}-service",
  "id": "<uuid>",
  "time": "<ISO 8601>",
  "data": {
    "id": "<uuid>",
    "tenantId": "<uuid>"
  }
}
\`\`\`

#### Consumer Configuration

| Consumer | Topic | Group ID | Retry Policy |
|---|---|---|---|
| | ${module}-events | ${module}-consumer | 3 retries, exponential backoff |
`,
            });
            break;

          default:
            // REST (default)
            files.push({
              path: `api-${module}-section.md`,
              content: `### ${capitalize(module)}

\`\`\`
GET    /api/v1/${module}s               → List
POST   /api/v1/${module}s               → Create
GET    /api/v1/${module}s/{id}          → Detail
PATCH  /api/v1/${module}s/{id}          → Update
DELETE /api/v1/${module}s/{id}          → Delete
\`\`\`
`,
            });
            break;
        }
      }

      // Frontend structure scaffold
      if (moduleType === "frontend" || moduleType === "fullstack") {
        files.push({
          path: `structure-${module}-section.md`,
          content: `### ${capitalize(module)} Module

\`\`\`
src/
├── routes/${module}/
│   ├── index.tsx           → List page
│   ├── $id.tsx             → Detail page
│   └── new.tsx             → Create page
├── components/${module}/
│   ├── ${module}-list.tsx
│   ├── ${module}-card.tsx
│   └── ${module}-form.tsx
├── api/${module}.api.ts
└── hooks/use-${module}.ts
\`\`\`
`,
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                module,
                type: moduleType,
                apiStyle: style,
                scaffolds: files.map((f) => ({
                  path: f.path,
                  preview: f.content.slice(0, 200) + "...",
                })),
                fullContent: files,
                instruction:
                  "Review these scaffolds and merge relevant sections into your existing docs (PRD, data-model, api-design, project-structure).",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
