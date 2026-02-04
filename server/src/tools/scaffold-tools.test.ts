import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerScaffoldTools } from "./scaffold-tools.js";

interface ToolRegistration {
  name: string;
  description: string;
  schema: unknown;
  handler: (...args: unknown[]) => Promise<unknown>;
}

interface MockMcpServer {
  tool: (
    name: string,
    description: string,
    schema: unknown,
    handler: (...args: unknown[]) => Promise<unknown>
  ) => void;
  registeredTools: Map<string, ToolRegistration>;
}

function createMockServer(): MockMcpServer {
  const registeredTools = new Map<string, ToolRegistration>();

  return {
    registeredTools,
    tool(
      name: string,
      description: string,
      schema: unknown,
      handler: (...args: unknown[]) => Promise<unknown>
    ) {
      registeredTools.set(name, { name, description, schema, handler });
    },
  };
}

interface ScaffoldResult {
  module: string;
  type: string;
  apiStyle: string;
  scaffolds: { path: string; preview: string }[];
  fullContent: { path: string; content: string }[];
  instruction: string;
}

function parseToolResult(result: {
  content: { type: string; text: string }[];
}): ScaffoldResult {
  return JSON.parse(result.content[0].text) as ScaffoldResult;
}

describe("scaffold-tools", () => {
  let mockServer: MockMcpServer;

  beforeEach(() => {
    mockServer = createMockServer();
    registerScaffoldTools(mockServer as unknown as McpServer);
  });

  describe("tool registration", () => {
    it("registers mags_scaffold_module tool", () => {
      expect(mockServer.registeredTools.has("mags_scaffold_module")).toBe(true);
    });

    it("has correct tool description", () => {
      const tool = mockServer.registeredTools.get("mags_scaffold_module");
      expect(tool?.description).toContain("Generate documentation scaffolds");
      expect(tool?.description).toContain("PRD section");
      expect(tool?.description).toContain("data model");
    });
  });

  describe("mags_scaffold_module", () => {
    async function invokeScaffold(params: {
      module: string;
      description: string;
      type?: "backend" | "frontend" | "fullstack" | null;
      apiStyle?: "rest" | "graphql" | "grpc" | "event-driven" | null;
      locale?: string | null;
    }): Promise<ScaffoldResult> {
      const tool = mockServer.registeredTools.get("mags_scaffold_module");
      if (!tool) throw new Error("Tool not registered");
      const result = (await tool.handler(params)) as {
        content: { type: string; text: string }[];
      };
      return parseToolResult(result);
    }

    describe("PRD section generation", () => {
      it("generates PRD section for any module", async () => {
        const result = await invokeScaffold({
          module: "payments",
          description: "Payment processing module",
        });

        const prdFile = result.fullContent.find((f) =>
          f.path.includes("prd-payments-section")
        );
        expect(prdFile).toBeDefined();
        expect(prdFile?.content).toContain("## M-NEW: Payments");
        expect(prdFile?.content).toContain("> Payment processing module");
        expect(prdFile?.content).toContain("### Features");
        expect(prdFile?.content).toContain("PAYMENTS-001");
        expect(prdFile?.content).toContain("### Acceptance Criteria");
      });

      it("capitalizes module name in PRD section", async () => {
        const result = await invokeScaffold({
          module: "analytics",
          description: "Analytics dashboard",
        });

        const prdFile = result.fullContent.find((f) =>
          f.path.includes("prd-analytics-section")
        );
        expect(prdFile?.content).toContain("## M-NEW: Analytics");
        expect(prdFile?.content).toContain("ANALYTICS-001");
      });
    });

    describe("data model generation", () => {
      it("generates data model for backend type", async () => {
        const result = await invokeScaffold({
          module: "inventory",
          description: "Inventory management",
          type: "backend",
        });

        const dataModelFile = result.fullContent.find((f) =>
          f.path.includes("data-model-inventory-section")
        );
        expect(dataModelFile).toBeDefined();
        expect(dataModelFile?.content).toContain("## Inventory Tables");
        expect(dataModelFile?.content).toContain("### inventory");
        expect(dataModelFile?.content).toContain("tenant_id");
        expect(dataModelFile?.content).toContain("UUID");
        expect(dataModelFile?.content).toContain("**Indexes:**");
        expect(dataModelFile?.content).toContain("idx_inventory_tenant");
      });

      it("generates data model for fullstack type", async () => {
        const result = await invokeScaffold({
          module: "orders",
          description: "Order management",
          type: "fullstack",
        });

        const dataModelFile = result.fullContent.find((f) =>
          f.path.includes("data-model-orders-section")
        );
        expect(dataModelFile).toBeDefined();
      });

      it("does not generate data model for frontend type", async () => {
        const result = await invokeScaffold({
          module: "dashboard",
          description: "Admin dashboard",
          type: "frontend",
        });

        const dataModelFile = result.fullContent.find((f) =>
          f.path.includes("data-model")
        );
        expect(dataModelFile).toBeUndefined();
      });
    });

    describe("REST API generation (default)", () => {
      it("generates REST API section by default", async () => {
        const result = await invokeScaffold({
          module: "product",
          description: "Product catalog",
          type: "backend",
        });

        expect(result.apiStyle).toBe("rest");
        const apiFile = result.fullContent.find((f) =>
          f.path.includes("api-product-section")
        );
        expect(apiFile).toBeDefined();
        expect(apiFile?.content).toContain("### Product");
        // Note: the code adds 's' to module name for pluralization
        expect(apiFile?.content).toContain("GET    /api/v1/products");
        expect(apiFile?.content).toContain("POST   /api/v1/products");
        expect(apiFile?.content).toContain("GET    /api/v1/products/{id}");
        expect(apiFile?.content).toContain("PATCH  /api/v1/products/{id}");
        expect(apiFile?.content).toContain("DELETE /api/v1/products/{id}");
      });

      it("generates REST API for fullstack without explicit apiStyle", async () => {
        const result = await invokeScaffold({
          module: "user",
          description: "User management",
          type: "fullstack",
        });

        expect(result.apiStyle).toBe("rest");
        const apiFile = result.fullContent.find((f) =>
          f.path.includes("api-user-section")
        );
        // Note: the code adds 's' to module name for pluralization
        expect(apiFile?.content).toContain("/api/v1/users");
      });
    });

    describe("GraphQL API generation", () => {
      it("generates GraphQL API section when apiStyle=graphql", async () => {
        const result = await invokeScaffold({
          module: "posts",
          description: "Blog posts",
          type: "backend",
          apiStyle: "graphql",
        });

        expect(result.apiStyle).toBe("graphql");
        const apiFile = result.fullContent.find((f) =>
          f.path.includes("api-posts-section")
        );
        expect(apiFile).toBeDefined();
        expect(apiFile?.content).toContain("### Posts (GraphQL)");
        expect(apiFile?.content).toContain("type Posts {");
        expect(apiFile?.content).toContain("id: ID!");
        expect(apiFile?.content).toContain("input CreatePostsInput {");
        expect(apiFile?.content).toContain("input UpdatePostsInput {");
        expect(apiFile?.content).toContain("type Query {");
        expect(apiFile?.content).toContain("posts(id: ID!): Posts");
        expect(apiFile?.content).toContain("type Mutation {");
        expect(apiFile?.content).toContain("createPosts(input:");
        expect(apiFile?.content).toContain("type PostsConnection {");
      });
    });

    describe("gRPC API generation", () => {
      it("generates gRPC API section when apiStyle=grpc", async () => {
        const result = await invokeScaffold({
          module: "notification",
          description: "Push notifications",
          type: "backend",
          apiStyle: "grpc",
        });

        expect(result.apiStyle).toBe("grpc");
        const apiFile = result.fullContent.find((f) =>
          f.path.includes("api-notification-section")
        );
        expect(apiFile).toBeDefined();
        expect(apiFile?.content).toContain("### Notification (gRPC)");
        expect(apiFile?.content).toContain("syntax = \"proto3\"");
        expect(apiFile?.content).toContain("package notification.v1");
        expect(apiFile?.content).toContain("service NotificationService {");
        expect(apiFile?.content).toContain("rpc GetNotification");
        expect(apiFile?.content).toContain("rpc ListNotifications");
        expect(apiFile?.content).toContain("rpc CreateNotification");
        expect(apiFile?.content).toContain("message Notification {");
      });
    });

    describe("event-driven API generation", () => {
      it("generates event-driven API section when apiStyle=event-driven", async () => {
        const result = await invokeScaffold({
          module: "audit",
          description: "Audit logging",
          type: "backend",
          apiStyle: "event-driven",
        });

        expect(result.apiStyle).toBe("event-driven");
        const apiFile = result.fullContent.find((f) =>
          f.path.includes("api-audit-section")
        );
        expect(apiFile).toBeDefined();
        expect(apiFile?.content).toContain("### Audit (Event-Driven)");
        expect(apiFile?.content).toContain("#### Events");
        expect(apiFile?.content).toContain("audit.created");
        expect(apiFile?.content).toContain("audit.updated");
        expect(apiFile?.content).toContain("audit.deleted");
        expect(apiFile?.content).toContain("audit-service");
        expect(apiFile?.content).toContain("AuditCreatedEvent");
        expect(apiFile?.content).toContain("#### Event Schemas");
        expect(apiFile?.content).toContain("specversion");
        expect(apiFile?.content).toContain("#### Consumer Configuration");
        expect(apiFile?.content).toContain("audit-events");
        expect(apiFile?.content).toContain("audit-consumer");
      });
    });

    describe("frontend structure generation", () => {
      it("generates frontend structure for fullstack type", async () => {
        const result = await invokeScaffold({
          module: "settings",
          description: "Application settings",
          type: "fullstack",
        });

        const structureFile = result.fullContent.find((f) =>
          f.path.includes("structure-settings-section")
        );
        expect(structureFile).toBeDefined();
        expect(structureFile?.content).toContain("### Settings Module");
        expect(structureFile?.content).toContain("src/");
        expect(structureFile?.content).toContain("routes/settings/");
        expect(structureFile?.content).toContain("index.tsx");
        expect(structureFile?.content).toContain("$id.tsx");
        expect(structureFile?.content).toContain("new.tsx");
        expect(structureFile?.content).toContain("components/settings/");
        expect(structureFile?.content).toContain("settings-list.tsx");
        expect(structureFile?.content).toContain("settings-card.tsx");
        expect(structureFile?.content).toContain("settings-form.tsx");
        expect(structureFile?.content).toContain("api/settings.api.ts");
        expect(structureFile?.content).toContain("hooks/use-settings.ts");
      });

      it("generates frontend structure for frontend type", async () => {
        const result = await invokeScaffold({
          module: "reports",
          description: "Report generation UI",
          type: "frontend",
        });

        const structureFile = result.fullContent.find((f) =>
          f.path.includes("structure-reports-section")
        );
        expect(structureFile).toBeDefined();
        expect(structureFile?.content).toContain("### Reports Module");
      });

      it("does not generate frontend structure for backend type", async () => {
        const result = await invokeScaffold({
          module: "cron",
          description: "Background jobs",
          type: "backend",
        });

        const structureFile = result.fullContent.find((f) =>
          f.path.includes("structure")
        );
        expect(structureFile).toBeUndefined();
      });
    });

    describe("locale parameter", () => {
      it("uses English labels by default", async () => {
        const result = await invokeScaffold({
          module: "tasks",
          description: "Task management",
          type: "fullstack",
        });

        const prdFile = result.fullContent.find((f) =>
          f.path.includes("prd-tasks-section")
        );
        expect(prdFile?.content).toContain("### Features");
        expect(prdFile?.content).toContain("Description");
        expect(prdFile?.content).toContain("Priority");
        expect(prdFile?.content).toContain("### Acceptance Criteria");

        const dataModelFile = result.fullContent.find((f) =>
          f.path.includes("data-model-tasks-section")
        );
        expect(dataModelFile?.content).toContain("Tables");
        expect(dataModelFile?.content).toContain("Column");
        expect(dataModelFile?.content).toContain("Type");
        expect(dataModelFile?.content).toContain("**Indexes:**");

        const structureFile = result.fullContent.find((f) =>
          f.path.includes("structure-tasks-section")
        );
        expect(structureFile?.content).toContain("Module");
        expect(structureFile?.content).toContain("List page");
        expect(structureFile?.content).toContain("Detail page");
        expect(structureFile?.content).toContain("Create page");
      });

      it("uses Turkish labels when locale=tr", async () => {
        const result = await invokeScaffold({
          module: "gorevler",
          description: "Gorev yonetimi",
          type: "fullstack",
          locale: "tr",
        });

        const prdFile = result.fullContent.find((f) =>
          f.path.includes("prd-gorevler-section")
        );
        expect(prdFile?.content).toContain("### Özellikler");
        expect(prdFile?.content).toContain("Açıklama");
        expect(prdFile?.content).toContain("Öncelik");
        expect(prdFile?.content).toContain("### Kabul Kriterleri");

        const dataModelFile = result.fullContent.find((f) =>
          f.path.includes("data-model-gorevler-section")
        );
        expect(dataModelFile?.content).toContain("Tablolar");
        expect(dataModelFile?.content).toContain("Kolon");
        expect(dataModelFile?.content).toContain("Tip");
        expect(dataModelFile?.content).toContain("**İndeksler:**");

        const structureFile = result.fullContent.find((f) =>
          f.path.includes("structure-gorevler-section")
        );
        expect(structureFile?.content).toContain("Modül");
        expect(structureFile?.content).toContain("Liste sayfası");
        expect(structureFile?.content).toContain("Detay sayfası");
        expect(structureFile?.content).toContain("Oluşturma sayfası");
      });

      it("uses English labels when locale=en explicitly", async () => {
        const result = await invokeScaffold({
          module: "billing",
          description: "Billing system",
          type: "fullstack",
          locale: "en",
        });

        const prdFile = result.fullContent.find((f) =>
          f.path.includes("prd-billing-section")
        );
        expect(prdFile?.content).toContain("### Features");
        expect(prdFile?.content).toContain("### Acceptance Criteria");
      });

      it("falls back to English for unsupported locale", async () => {
        const result = await invokeScaffold({
          module: "shipping",
          description: "Shipping management",
          type: "fullstack",
          locale: "de", // German not supported
        });

        const prdFile = result.fullContent.find((f) =>
          f.path.includes("prd-shipping-section")
        );
        expect(prdFile?.content).toContain("### Features");
        expect(prdFile?.content).toContain("### Acceptance Criteria");
      });

      it("uses Turkish labels for event-driven API", async () => {
        const result = await invokeScaffold({
          module: "mesajlar",
          description: "Mesajlasma servisi",
          type: "backend",
          apiStyle: "event-driven",
          locale: "tr",
        });

        const apiFile = result.fullContent.find((f) =>
          f.path.includes("api-mesajlar-section")
        );
        expect(apiFile?.content).toContain("#### Olaylar");
        expect(apiFile?.content).toContain("Üretici");
        expect(apiFile?.content).toContain("Tüketici");
        expect(apiFile?.content).toContain("Şema");
        expect(apiFile?.content).toContain("#### Olay Şemaları");
        expect(apiFile?.content).toContain("#### Tüketici Yapılandırması");
      });
    });

    describe("result structure", () => {
      it("returns correct module name", async () => {
        const result = await invokeScaffold({
          module: "catalog",
          description: "Product catalog",
        });

        expect(result.module).toBe("catalog");
      });

      it("returns correct type (defaults to fullstack)", async () => {
        const result = await invokeScaffold({
          module: "catalog",
          description: "Product catalog",
        });

        expect(result.type).toBe("fullstack");
      });

      it("returns correct apiStyle (defaults to rest)", async () => {
        const result = await invokeScaffold({
          module: "catalog",
          description: "Product catalog",
        });

        expect(result.apiStyle).toBe("rest");
      });

      it("returns scaffolds array with previews", async () => {
        const result = await invokeScaffold({
          module: "catalog",
          description: "Product catalog",
          type: "fullstack",
        });

        expect(result.scaffolds.length).toBeGreaterThan(0);
        result.scaffolds.forEach((scaffold) => {
          expect(scaffold.path).toBeDefined();
          expect(scaffold.preview).toBeDefined();
          expect(scaffold.preview.endsWith("...")).toBe(true);
        });
      });

      it("returns fullContent array with complete content", async () => {
        const result = await invokeScaffold({
          module: "catalog",
          description: "Product catalog",
          type: "fullstack",
        });

        expect(result.fullContent.length).toBeGreaterThan(0);
        result.fullContent.forEach((file) => {
          expect(file.path).toBeDefined();
          expect(file.content).toBeDefined();
          expect(file.content.length).toBeGreaterThan(200);
        });
      });

      it("returns instruction for merging", async () => {
        const result = await invokeScaffold({
          module: "catalog",
          description: "Product catalog",
        });

        expect(result.instruction).toContain("Review these scaffolds");
        expect(result.instruction).toContain("merge");
      });
    });

    describe("file count by type", () => {
      it("generates 4 files for fullstack type with REST", async () => {
        const result = await invokeScaffold({
          module: "complete",
          description: "Complete module",
          type: "fullstack",
          apiStyle: "rest",
        });

        // PRD, data model, API, structure
        expect(result.fullContent).toHaveLength(4);
        expect(result.fullContent.map((f) => f.path)).toContain(
          "prd-complete-section.md"
        );
        expect(result.fullContent.map((f) => f.path)).toContain(
          "data-model-complete-section.md"
        );
        expect(result.fullContent.map((f) => f.path)).toContain(
          "api-complete-section.md"
        );
        expect(result.fullContent.map((f) => f.path)).toContain(
          "structure-complete-section.md"
        );
      });

      it("generates 3 files for backend type", async () => {
        const result = await invokeScaffold({
          module: "backend",
          description: "Backend only module",
          type: "backend",
        });

        // PRD, data model, API (no structure)
        expect(result.fullContent).toHaveLength(3);
        expect(result.fullContent.map((f) => f.path)).not.toContain(
          "structure-backend-section.md"
        );
      });

      it("generates 2 files for frontend type", async () => {
        const result = await invokeScaffold({
          module: "frontend",
          description: "Frontend only module",
          type: "frontend",
        });

        // PRD, structure (no data model, no API)
        expect(result.fullContent).toHaveLength(2);
        expect(result.fullContent.map((f) => f.path)).toContain(
          "prd-frontend-section.md"
        );
        expect(result.fullContent.map((f) => f.path)).toContain(
          "structure-frontend-section.md"
        );
      });
    });
  });
});
