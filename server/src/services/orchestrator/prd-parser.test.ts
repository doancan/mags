// ============================================
// MAGS — PRD Parser Tests
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PrdParser, createPrdParser } from "./prd-parser.js";

describe("PrdParser", () => {
  let parser: PrdParser;
  let tempDir: string;

  beforeEach(() => {
    parser = createPrdParser();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mags-prd-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writePrd = (content: string): string => {
    const filePath = path.join(tempDir, "prd.md");
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  describe("parse", () => {
    it("should parse valid PRD with modules", async () => {
      const prd = writePrd(`---
title: "TestApp: Product Requirements"
---

# TestApp — Product Requirements (PRD)

## Overview

A test application for unit testing.

## Modules

### M1: auth
> Authentication and authorization module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Email/password login | P0 | 1 |
| M1-002 | Register | User registration | P0 | 1 |

#### Acceptance Criteria
- [ ] User can login with email
- [ ] User can register

#### Dependencies
- Requires: []
- Blocks: [crm]

---

### M2: crm
> Customer relationship management

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | Customers | Customer management | P1 | 2 |

#### Acceptance Criteria
- [ ] Can create customer

#### Dependencies
- Requires: [auth]
- Blocks: []
`);

      const result = await parser.parse(prd);

      expect(result).not.toBeNull();
      expect(result!.project.name).toBe("TestApp");
      expect(result!.modules).toHaveLength(2);
      expect(result!.totalFeatures).toBe(3);

      // Check auth module
      const auth = result!.modules.find((m) => m.name === "auth");
      expect(auth).toBeDefined();
      expect(auth!.id).toBe("M1");
      expect(auth!.features).toHaveLength(2);
      expect(auth!.acceptanceCriteria).toHaveLength(2);
      expect(auth!.dependencies.blocks).toContain("crm");

      // Check crm module
      const crm = result!.modules.find((m) => m.name === "crm");
      expect(crm).toBeDefined();
      expect(crm!.dependencies.requires).toContain("auth");
    });

    it("should extract project name from H1 header", async () => {
      const prd = writePrd(`# MyProject — PRD

## Modules

### M1: test
> Test module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Test | Test feature | P0 | 1 |
`);

      const result = await parser.parse(prd);
      expect(result!.project.name).toBe("MyProject");
    });

    it("should build dependency graph", async () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Login | P0 | 1 |

#### Dependencies
- Requires: []
- Blocks: [tenant]

---

### M2: tenant
> Tenant

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | Tenant | Tenant | P0 | 1 |

#### Dependencies
- Requires: [auth]
- Blocks: [crm]

---

### M3: crm
> CRM

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M3-001 | CRM | CRM | P1 | 2 |

#### Dependencies
- Requires: [tenant]
- Blocks: []
`);

      const result = await parser.parse(prd);
      expect(result!.dependencyGraph).toHaveLength(3);

      const authNode = result!.dependencyGraph.find((n) => n.module === "auth");
      expect(authNode!.dependsOn).toHaveLength(0);

      const tenantNode = result!.dependencyGraph.find((n) => n.module === "tenant");
      expect(tenantNode!.dependsOn).toContain("auth");

      const crmNode = result!.dependencyGraph.find((n) => n.module === "crm");
      expect(crmNode!.dependsOn).toContain("tenant");
    });

    it("should return null for missing file", async () => {
      const result = await parser.parse("/nonexistent/prd.md");
      expect(result).toBeNull();
      expect(parser.getErrors()).toHaveLength(1);
      expect(parser.getErrors()[0].type).toBe("missing");
    });
  });

  describe("validation", () => {
    it("should detect invalid feature ID format", async () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth module

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| X1-001 | Login | Login | P0 | 1 |
`);

      const result = await parser.parse(prd);
      expect(parser.getErrors()).toHaveLength(1);
      expect(parser.getErrors()[0].message).toContain("X1-001");
    });

    it("should detect circular dependencies", async () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Login | P0 | 1 |

#### Dependencies
- Requires: [crm]
- Blocks: []

---

### M2: crm
> CRM

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | CRM | CRM | P0 | 1 |

#### Dependencies
- Requires: [auth]
- Blocks: []
`);

      const result = await parser.parse(prd);
      expect(result).toBeNull();
      expect(parser.getErrors().some((e) => e.type === "dependency")).toBe(true);
    });

    it("should detect unknown dependency reference", async () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Login | P0 | 1 |

#### Dependencies
- Requires: [nonexistent]
- Blocks: []
`);

      const result = await parser.parse(prd);
      expect(result).toBeNull();
      expect(parser.getErrors().some((e) => e.type === "reference")).toBe(true);
    });

    it("should warn for module without features", async () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth module
`);

      await parser.parse(prd);
      expect(parser.getWarnings().some((w) => w.message.includes("no features"))).toBe(true);
    });
  });

  describe("validate", () => {
    it("should return validation result", () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Login | P0 | 1 |
`);

      const result = parser.validate(prd);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return errors for invalid PRD", () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| WRONG-001 | Login | Login | P0 | 1 |
`);

      const result = parser.validate(prd);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("phases", () => {
    it("should extract phases from modules", async () => {
      const prd = writePrd(`# Test

## Modules

### M1: auth
> Auth

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M1-001 | Login | Login | P0 | 1 |

---

### M2: analytics
> Analytics

#### Features
| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| M2-001 | Dashboard | Dashboard | P2 | 2 |
`);

      const result = await parser.parse(prd);
      expect(result!.phases).toHaveLength(2);
      expect(result!.phases[0].phase).toBe(1);
      expect(result!.phases[0].modules).toContain("auth");
      expect(result!.phases[1].phase).toBe(2);
      expect(result!.phases[1].modules).toContain("analytics");
    });
  });
});
