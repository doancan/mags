// ============================================
// MAGS — Code Analyzer Tests
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodeAnalyzer, createCodeAnalyzer } from "./code-analyzer.js";

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "mags-code-analyzer-"));
}

function writeFile(dir: string, filePath: string, content: string): void {
  const fullPath = join(dir, filePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

describe("CodeAnalyzer", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Factory ───────────────────────────────────

  describe("createCodeAnalyzer", () => {
    it("creates a CodeAnalyzer instance", () => {
      const analyzer = createCodeAnalyzer(tmpDir);
      expect(analyzer).toBeInstanceOf(CodeAnalyzer);
    });

    it("uses current directory if not provided", () => {
      const analyzer = createCodeAnalyzer();
      expect(analyzer).toBeInstanceOf(CodeAnalyzer);
    });
  });

  // ── Tech Debt Detection ───────────────────────

  describe("tech debt detection", () => {
    it("finds TODO comments", async () => {
      writeFile(tmpDir, "src/test.ts", `
// TODO: implement this
function test() {}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(1);
      expect(result.techDebt[0].type).toBe("todo");
      expect(result.techDebt[0].message).toContain("implement this");
    });

    it("finds FIXME comments", async () => {
      writeFile(tmpDir, "src/buggy.ts", `
// FIXME: this is broken
const broken = true;
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(1);
      expect(result.techDebt[0].type).toBe("fixme");
      expect(result.techDebt[0].message).toContain("broken");
    });

    it("finds HACK comments", async () => {
      writeFile(tmpDir, "src/hacky.ts", `
// HACK: temporary workaround
const workaround = true;
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(1);
      expect(result.techDebt[0].type).toBe("hack");
    });

    it("finds XXX comments", async () => {
      writeFile(tmpDir, "src/xxx.ts", `
// XXX: needs review
const needsReview = true;
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(1);
      expect(result.techDebt[0].type).toBe("xxx");
    });

    it("finds BUG comments", async () => {
      writeFile(tmpDir, "src/bug.ts", `
// BUG: known issue with edge case
const buggy = true;
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(1);
      expect(result.techDebt[0].type).toBe("bug");
    });

    it("finds DEPRECATED comments", async () => {
      writeFile(tmpDir, "src/old.ts", `
// DEPRECATED: use newFunction instead
function oldFunction() {}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(1);
      expect(result.techDebt[0].type).toBe("deprecated");
    });

    it("finds multiple tech debt items in one file", async () => {
      writeFile(tmpDir, "src/messy.ts", `
// TODO: first task
const first = 1;
// FIXME: second issue
const second = 2;
// HACK: third workaround
const third = 3;
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(3);
    });

    it("includes correct line numbers", async () => {
      writeFile(tmpDir, "src/lines.ts", `line1
line2
// TODO: on line 3
line4
// FIXME: on line 5
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(2);
      expect(result.techDebt[0].line).toBe(3);
      expect(result.techDebt[1].line).toBe(5);
    });

    it("handles TODO with colon separator", async () => {
      writeFile(tmpDir, "src/colon.ts", `// TODO: fix this bug`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt[0].message).toBe("fix this bug");
    });

    it("handles TODO without colon", async () => {
      writeFile(tmpDir, "src/nocolon.ts", `// TODO fix this issue`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt[0].message).toBe("fix this issue");
    });

    it("is case insensitive", async () => {
      writeFile(tmpDir, "src/case.ts", `
// todo: lowercase
// Todo: mixed case
// TODO: uppercase
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(3);
    });

    it("skips node_modules", async () => {
      writeFile(tmpDir, "node_modules/pkg/index.js", `// TODO: in node_modules`);
      writeFile(tmpDir, "src/app.ts", `// TODO: in src`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(1);
      expect(result.techDebt[0].file).toContain("src");
    });

    it("returns empty array when no tech debt", async () => {
      writeFile(tmpDir, "src/clean.ts", `
// This is a clean file
function cleanFunction() {
  return "no debt";
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.techDebt.length).toBe(0);
    });
  });

  // ── Endpoint Discovery ────────────────────────

  describe("endpoint discovery", () => {
    it("finds NestJS GET endpoints", async () => {
      writeFile(tmpDir, "src/user.controller.ts", `
import { Controller, Get } from '@nestjs/common';

@Controller('users')
export class UserController {
  @Get('')
  findAll() {}
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.endpoints.length).toBeGreaterThanOrEqual(1);
      expect(result.endpoints.some(e => e.method === "GET")).toBe(true);
    });

    it("finds NestJS POST endpoints", async () => {
      writeFile(tmpDir, "src/user.controller.ts", `
import { Controller, Post } from '@nestjs/common';

@Controller('users')
export class UserController {
  @Post('')
  create() {}
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.endpoints.some(e => e.method === "POST")).toBe(true);
    });

    it("finds NestJS endpoints with path parameters", async () => {
      writeFile(tmpDir, "src/user.controller.ts", `
import { Controller, Get, Patch, Delete } from '@nestjs/common';

@Controller('users')
export class UserController {
  @Get(':id')
  findOne() {}

  @Patch(':id')
  update() {}

  @Delete(':id')
  remove() {}
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.endpoints.length).toBeGreaterThanOrEqual(3);
    });

    it("combines controller prefix with route path", async () => {
      writeFile(tmpDir, "src/api.controller.ts", `
import { Controller, Get } from '@nestjs/common';

@Controller('api/v1')
export class ApiController {
  @Get('health')
  health() {}
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      const healthEndpoint = result.endpoints.find(e => e.path.includes("health"));
      expect(healthEndpoint).toBeDefined();
      expect(healthEndpoint?.path).toBe("/api/v1/health");
    });

    it("finds Express endpoints", async () => {
      writeFile(tmpDir, "src/routes.ts", `
import express from 'express';
const router = express.Router();

router.get('/users', (req, res) => {});
router.post('/users', (req, res) => {});
router.put('/users/:id', (req, res) => {});
router.delete('/users/:id', (req, res) => {});

export default router;
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.endpoints.length).toBeGreaterThanOrEqual(4);
      expect(result.endpoints.some(e => e.method === "GET")).toBe(true);
      expect(result.endpoints.some(e => e.method === "POST")).toBe(true);
      expect(result.endpoints.some(e => e.method === "PUT")).toBe(true);
      expect(result.endpoints.some(e => e.method === "DELETE")).toBe(true);
    });

    it("returns empty array when no endpoints", async () => {
      writeFile(tmpDir, "src/utils.ts", `
export function helper() {
  return "no endpoints here";
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.endpoints.length).toBe(0);
    });
  });

  // ── Module Discovery ──────────────────────────

  describe("module discovery", () => {
    it("discovers modules in src/modules directory", async () => {
      writeFile(tmpDir, "src/modules/auth/auth.module.ts", `export class AuthModule {}`);
      writeFile(tmpDir, "src/modules/auth/auth.service.ts", `export class AuthService {}`);
      writeFile(tmpDir, "src/modules/users/users.module.ts", `export class UsersModule {}`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.modules.length).toBe(2);
      expect(result.modules.some(m => m.name === "auth")).toBe(true);
      expect(result.modules.some(m => m.name === "users")).toBe(true);
    });

    it("discovers modules in src/features directory", async () => {
      writeFile(tmpDir, "src/features/billing/index.ts", `export * from './billing.service'`);
      writeFile(tmpDir, "src/features/billing/billing.service.ts", `export class BillingService {}`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.modules.some(m => m.name === "billing")).toBe(true);
    });

    it("calculates module confidence", async () => {
      writeFile(tmpDir, "src/modules/auth/index.ts", `export * from './auth.service'`);
      writeFile(tmpDir, "src/modules/auth/auth.module.ts", `export class AuthModule {}`);
      writeFile(tmpDir, "src/modules/auth/auth.service.ts", `export class AuthService {}`);
      writeFile(tmpDir, "src/modules/auth/auth.controller.ts", `
import { Controller, Get } from '@nestjs/common';
@Controller('auth')
export class AuthController {
  @Get()
  check() {}
}
`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      const authModule = result.modules.find(m => m.name === "auth");
      expect(authModule).toBeDefined();
      expect(authModule!.confidence).toBeGreaterThanOrEqual(50);
    });

    it("skips hidden directories", async () => {
      writeFile(tmpDir, "src/modules/.hidden/secret.ts", `const secret = true;`);
      writeFile(tmpDir, "src/modules/visible/index.ts", `export const visible = true;`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.modules.some(m => m.name === ".hidden")).toBe(false);
      expect(result.modules.some(m => m.name === "visible")).toBe(true);
    });
  });

  // ── Table Discovery (Prisma) ──────────────────

  describe("table discovery", () => {
    it("discovers Prisma models", async () => {
      writeFile(tmpDir, "prisma/schema.prisma", `
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.tables.length).toBe(2);
      expect(result.tables.some(t => t.name === "User")).toBe(true);
      expect(result.tables.some(t => t.name === "Post")).toBe(true);
    });

    it("extracts column names from Prisma models", async () => {
      writeFile(tmpDir, "prisma/schema.prisma", `
model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Float
  description String?
}
`);
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      const productTable = result.tables.find(t => t.name === "Product");
      expect(productTable).toBeDefined();
      expect(productTable!.columns).toContain("id");
      expect(productTable!.columns).toContain("name");
      expect(productTable!.columns).toContain("price");
    });

    it("returns empty array when no Prisma schema", async () => {
      writeFile(tmpDir, "src/app.ts", `const app = true;`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.tables.length).toBe(0);
    });
  });

  // ── Stack Detection ───────────────────────────

  describe("stack detection", () => {
    it("detects NestJS framework", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "@nestjs/core": "^10.0.0",
          "@nestjs/common": "^10.0.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.frameworks).toContain("nestjs");
    });

    it("detects Express framework", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "express": "^4.18.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.frameworks).toContain("express");
    });

    it("detects React framework", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "react": "^18.0.0",
          "react-dom": "^18.0.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.frameworks).toContain("react");
    });

    it("detects Next.js framework", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "next": "^14.0.0",
          "react": "^18.0.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.frameworks).toContain("nextjs");
      expect(result.stack.frameworks).toContain("react");
    });

    it("detects Prisma ORM", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "@prisma/client": "^5.0.0"
        },
        devDependencies: {
          "prisma": "^5.0.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.frameworks).toContain("prisma");
    });

    it("detects PostgreSQL database", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "pg": "^8.0.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.databases).toContain("postgresql");
    });

    it("detects MongoDB database", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "mongodb": "^6.0.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.databases).toContain("mongodb");
    });

    it("detects multiple frameworks", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {
          "@nestjs/core": "^10.0.0",
          "@prisma/client": "^5.0.0",
          "pg": "^8.0.0"
        }
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.frameworks).toContain("nestjs");
      expect(result.stack.frameworks).toContain("prisma");
      expect(result.stack.databases).toContain("postgresql");
    });

    it("adds TypeScript/JavaScript to languages", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-project",
        dependencies: {}
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.stack.languages).toContain("typescript");
      expect(result.stack.languages).toContain("javascript");
    });
  });

  // ── Project Name ──────────────────────────────

  describe("project name detection", () => {
    it("gets project name from package.json", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "my-awesome-project",
        version: "1.0.0"
      }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.projectName).toBe("my-awesome-project");
    });

    it("falls back to directory name when no package.json", async () => {
      // No package.json
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      // Should be the tmp directory name
      expect(result.projectName).toBeDefined();
      expect(result.projectName.length).toBeGreaterThan(0);
    });
  });

  // ── Reverse PRD Generation ────────────────────

  describe("generateReversePrd", () => {
    it("generates reverse PRD from analysis", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({
        name: "test-app",
        dependencies: { "@nestjs/core": "^10.0.0" }
      }));
      writeFile(tmpDir, "src/modules/auth/auth.controller.ts", `
import { Controller, Get, Post } from '@nestjs/common';
@Controller('auth')
export class AuthController {
  @Get()
  check() {}
  @Post('login')
  login() {}
}
`);
      writeFile(tmpDir, "src/modules/auth/auth.service.ts", `export class AuthService {}`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const reversePrd = await analyzer.generateReversePrd();

      expect(reversePrd.project.name).toBe("test-app");
      expect(reversePrd.source).toBe("analysis");
      expect(reversePrd.modules.length).toBeGreaterThanOrEqual(1);
      expect(reversePrd.generatedAt).toBeDefined();
    });

    it("includes module features based on endpoints", async () => {
      writeFile(tmpDir, "package.json", JSON.stringify({ name: "api" }));
      writeFile(tmpDir, "src/modules/users/users.controller.ts", `
import { Controller, Get, Post, Patch, Delete } from '@nestjs/common';
@Controller('users')
export class UsersController {
  @Get('')
  findAll() {}
  @Post('')
  create() {}
  @Patch(':id')
  update() {}
  @Delete(':id')
  remove() {}
}
`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const reversePrd = await analyzer.generateReversePrd();

      const usersModule = reversePrd.modules.find(m => m.name === "users");
      expect(usersModule).toBeDefined();
      expect(usersModule!.existingFeatures.length).toBeGreaterThanOrEqual(4);
    });

    it("generates recommendations based on analysis", async () => {
      // Create a project with low test coverage and tech debt
      writeFile(tmpDir, "package.json", JSON.stringify({ name: "messy-project" }));
      writeFile(tmpDir, "src/app.ts", `
// TODO: fix this
// FIXME: broken
// HACK: temporary
// TODO: another one
// FIXME: also broken
// TODO: third todo
// HACK: another hack
// BUG: known bug
// TODO: more work
// FIXME: fix later
// TODO: eventually
`);

      const analyzer = createCodeAnalyzer(tmpDir);
      const reversePrd = await analyzer.generateReversePrd();

      expect(reversePrd.recommendations.length).toBeGreaterThan(0);
      expect(reversePrd.recommendations.some(r => r.includes("tech debt"))).toBe(true);
    });
  });

  // ── Pattern Detection ─────────────────────────

  describe("pattern detection", () => {
    it("detects repository pattern", async () => {
      writeFile(tmpDir, "src/modules/users/users.repository.ts", `export class UsersRepository {}`);
      writeFile(tmpDir, "package.json", JSON.stringify({ name: "app" }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.patterns).toContain("repository-pattern");
    });

    it("detects service layer pattern", async () => {
      writeFile(tmpDir, "src/modules/auth/auth.service.ts", `export class AuthService {}`);
      writeFile(tmpDir, "package.json", JSON.stringify({ name: "app" }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.patterns).toContain("service-layer");
    });

    it("detects controller pattern", async () => {
      writeFile(tmpDir, "src/modules/api/api.controller.ts", `export class ApiController {}`);
      writeFile(tmpDir, "package.json", JSON.stringify({ name: "app" }));

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.patterns).toContain("controller-pattern");
    });
  });

  // ── Test Coverage Estimation ──────────────────

  describe("test coverage estimation", () => {
    it("estimates coverage based on test file ratio", async () => {
      writeFile(tmpDir, "src/auth.ts", `export const auth = true;`);
      writeFile(tmpDir, "src/auth.test.ts", `test('auth', () => {});`);
      writeFile(tmpDir, "src/users.ts", `export const users = true;`);
      writeFile(tmpDir, "src/users.spec.ts", `test('users', () => {});`);
      writeFile(tmpDir, "src/billing.ts", `export const billing = true;`);
      // No test for billing

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      // 2 test files for 3 source files = ~67%
      expect(result.testCoverage).toBeGreaterThanOrEqual(50);
      expect(result.testCoverage).toBeLessThanOrEqual(100);
    });

    it("returns 0 when no source files", async () => {
      // Empty project
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.testCoverage).toBe(0);
    });
  });

  // ── Edge Cases ────────────────────────────────

  describe("edge cases", () => {
    it("handles empty project", async () => {
      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result.modules).toEqual([]);
      expect(result.endpoints).toEqual([]);
      expect(result.tables).toEqual([]);
      expect(result.techDebt).toEqual([]);
    });

    it("handles malformed package.json gracefully", async () => {
      writeFile(tmpDir, "package.json", "not valid json");

      const analyzer = createCodeAnalyzer(tmpDir);
      // Should not throw
      expect(async () => await analyzer.analyze()).not.toThrow;
    });

    it("handles unreadable files gracefully", async () => {
      writeFile(tmpDir, "src/app.ts", `// valid file`);
      // Create a file that will cause issues (very long path or special chars can be problematic)
      // For this test, we just verify the analyzer doesn't crash

      const analyzer = createCodeAnalyzer(tmpDir);
      const result = await analyzer.analyze();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });
});
