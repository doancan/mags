import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { StackDetector } from "./stack-detector.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `mags-stack-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("StackDetector", () => {
  let projectRoot: string;
  let detector: StackDetector;

  beforeEach(() => {
    projectRoot = makeTmpDir();
    detector = new StackDetector();
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("empty directory", () => {
    it("returns empty arrays for a bare directory", () => {
      const result = detector.detect(projectRoot);
      expect(result.languages).toEqual([]);
      expect(result.frameworks).toEqual([]);
      expect(result.databases).toEqual([]);
      expect(result.apiStyle).toEqual(["rest"]); // default
      expect(result.packageManager).toBe("");
    });
  });

  describe("Node.js detection", () => {
    it("detects typescript/javascript from package.json", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "test-app", dependencies: {} }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("typescript/javascript");
    });

    it("detects npm as default package manager", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "test" }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.packageManager).toBe("npm");
    });

    it("detects pnpm from pnpm-lock.yaml", () => {
      writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ name: "test" }), "utf-8");
      writeFileSync(join(projectRoot, "pnpm-lock.yaml"), "", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.packageManager).toBe("pnpm");
    });

    it("detects yarn from yarn.lock", () => {
      writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ name: "test" }), "utf-8");
      writeFileSync(join(projectRoot, "yarn.lock"), "", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.packageManager).toBe("yarn");
    });

    it("detects bun from bun.lockb", () => {
      writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ name: "test" }), "utf-8");
      writeFileSync(join(projectRoot, "bun.lockb"), "", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.packageManager).toBe("bun");
    });

    it("detects React framework from dependencies", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { react: "^18.0.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("React");
    });

    it("detects Next.js framework", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { next: "^14.0.0", react: "^18.0.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Next.js");
      expect(result.frameworks).toContain("React");
    });

    it("detects Express framework", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { express: "^4.18.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Express");
    });

    it("detects NestJS from @nestjs/core", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { "@nestjs/core": "^10.0.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("NestJS");
    });

    it("detects TypeScript when typescript dep exists", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ devDependencies: { typescript: "^5.0.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("typescript");
    });

    it("detects database dependencies", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { pg: "^8.0.0", redis: "^4.0.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.databases).toContain("PostgreSQL");
      expect(result.databases).toContain("Redis");
    });

    it("detects Prisma ORM", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { "@prisma/client": "^5.0.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.databases).toContain("Prisma ORM");
    });
  });

  describe("Python detection", () => {
    it("detects python from requirements.txt", () => {
      writeFileSync(join(projectRoot, "requirements.txt"), "flask==2.3.0\nrequests==2.31.0\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("python");
    });

    it("detects Flask framework from requirements.txt", () => {
      writeFileSync(join(projectRoot, "requirements.txt"), "flask==2.3.0\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Flask");
    });

    it("detects FastAPI from requirements.txt", () => {
      writeFileSync(join(projectRoot, "requirements.txt"), "fastapi==0.100.0\nuvicorn==0.23.0\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("FastAPI");
    });

    it("detects Django from requirements.txt", () => {
      writeFileSync(join(projectRoot, "requirements.txt"), "django==4.2.0\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Django");
    });

    it("detects python from pyproject.toml", () => {
      writeFileSync(join(projectRoot, "pyproject.toml"), "[tool.poetry]\nname = \"myapp\"\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("python");
      expect(result.packageManager).toBe("poetry");
    });

    it("detects pip as default package manager", () => {
      writeFileSync(join(projectRoot, "pyproject.toml"), "[project]\nname = \"myapp\"\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.packageManager).toBe("pip");
    });

    it("detects python from setup.py", () => {
      writeFileSync(join(projectRoot, "setup.py"), "from setuptools import setup\nsetup(name='myapp')\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("python");
    });
  });

  describe("Go detection", () => {
    it("detects go from go.mod", () => {
      writeFileSync(join(projectRoot, "go.mod"), "module example.com/myapp\n\ngo 1.21\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("go");
      expect(result.packageManager).toBe("go modules");
    });

    it("detects Gin framework from go.mod", () => {
      writeFileSync(
        join(projectRoot, "go.mod"),
        "module example.com/myapp\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.0\n",
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Gin");
    });

    it("detects Echo framework from go.mod", () => {
      writeFileSync(
        join(projectRoot, "go.mod"),
        "module example.com/myapp\n\ngo 1.21\n\nrequire github.com/labstack/echo v4.11.0\n",
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Echo");
    });

    it("detects Chi framework from go.mod", () => {
      writeFileSync(
        join(projectRoot, "go.mod"),
        "module example.com/myapp\n\ngo 1.21\n\nrequire github.com/go-chi/chi v5.0.0\n",
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Chi");
    });
  });

  describe("Rust detection", () => {
    it("detects rust from Cargo.toml", () => {
      writeFileSync(
        join(projectRoot, "Cargo.toml"),
        '[package]\nname = "myapp"\nversion = "0.1.0"\n',
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("rust");
      expect(result.packageManager).toBe("cargo");
    });

    it("detects Actix Web from Cargo.toml", () => {
      writeFileSync(
        join(projectRoot, "Cargo.toml"),
        '[dependencies]\nactix-web = "4"\n',
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Actix Web");
    });

    it("detects Axum from Cargo.toml", () => {
      writeFileSync(
        join(projectRoot, "Cargo.toml"),
        '[dependencies]\naxum = "0.6"\ntokio = { version = "1", features = ["full"] }\n',
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Axum");
      expect(result.frameworks).toContain("Tokio");
    });
  });

  describe("Java detection", () => {
    it("detects java from pom.xml", () => {
      writeFileSync(
        join(projectRoot, "pom.xml"),
        '<project><groupId>com.example</groupId><artifactId>myapp</artifactId></project>',
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("java");
      expect(result.packageManager).toBe("maven");
    });

    it("detects Spring Boot from pom.xml", () => {
      writeFileSync(
        join(projectRoot, "pom.xml"),
        '<project><dependencies><dependency>spring-boot-starter-web</dependency></dependencies></project>',
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.frameworks).toContain("Spring Boot");
    });

    it("detects java from build.gradle", () => {
      writeFileSync(
        join(projectRoot, "build.gradle"),
        "plugins {\n  id 'java'\n}\n",
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("java");
      expect(result.packageManager).toBe("gradle");
    });
  });

  describe("GraphQL detection", () => {
    it("detects graphql from schema.graphql file", () => {
      writeFileSync(join(projectRoot, "schema.graphql"), "type Query { hello: String }\n", "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.apiStyle).toContain("graphql");
    });

    it("detects graphql from .graphqlrc file", () => {
      writeFileSync(join(projectRoot, ".graphqlrc"), '{ "schema": "./schema.graphql" }\n', "utf-8");
      const result = detector.detect(projectRoot);
      expect(result.apiStyle).toContain("graphql");
    });

    it("detects graphql from package.json deps", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { graphql: "^16.0.0", "@apollo/server": "^4.0.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.apiStyle).toContain("graphql");
    });
  });

  describe("multi-language project", () => {
    it("detects multiple languages in a single project", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { express: "^4.18.0" }, devDependencies: { typescript: "^5.0.0" } }),
        "utf-8"
      );
      writeFileSync(join(projectRoot, "requirements.txt"), "fastapi==0.100.0\n", "utf-8");
      writeFileSync(join(projectRoot, "go.mod"), "module example.com/myapp\n\ngo 1.21\n", "utf-8");

      const result = detector.detect(projectRoot);
      expect(result.languages).toContain("typescript");
      expect(result.languages).toContain("python");
      expect(result.languages).toContain("go");
      expect(result.frameworks).toContain("Express");
      expect(result.frameworks).toContain("FastAPI");
    });
  });

  describe("database detection from docker-compose", () => {
    it("detects databases from docker-compose.yml", () => {
      writeFileSync(
        join(projectRoot, "docker-compose.yml"),
        "services:\n  db:\n    image: postgres:15\n  cache:\n    image: redis:7\n",
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.databases).toContain("PostgreSQL");
      expect(result.databases).toContain("Redis");
    });

    it("detects MongoDB from docker-compose.yaml", () => {
      writeFileSync(
        join(projectRoot, "docker-compose.yaml"),
        "services:\n  db:\n    image: mongo:6\n",
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.databases).toContain("MongoDB");
    });
  });

  describe("default api style", () => {
    it("defaults to rest when no API style indicators found", () => {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ dependencies: { express: "^4.18.0" } }),
        "utf-8"
      );
      const result = detector.detect(projectRoot);
      expect(result.apiStyle).toContain("rest");
    });
  });

  // ============================================
  // Fallback Chain Tests
  // ============================================

  describe("detectWithFallback", () => {
    describe("with .mags.yaml config", () => {
      it("uses stack config when no package files exist", () => {
        // Empty directory, but config provided
        const config = {
          docsDir: "docs",
          magsDir: "docs/.mags",
          templates: "general" as const,
          autoSessionSave: true,
          autoSessionLoad: true,
          docValidation: true,
          locale: "en",
          embedding: { provider: "local" as const },
          stack: {
            primaryLanguage: "typescript",
            frameworks: ["NestJS", "React"],
            databases: ["PostgreSQL"],
            apiStyle: ["rest"],
            packageManager: "pnpm",
          },
        };

        const result = detector.detectWithFallback(projectRoot, config);
        expect(result.languages).toContain("typescript");
        expect(result.frameworks).toContain("NestJS");
        expect(result.frameworks).toContain("React");
        expect(result.databases).toContain("PostgreSQL");
        expect(result.packageManager).toBe("pnpm");
      });

      it("merges config stack with detected stack", () => {
        // Has package.json with React
        writeFileSync(
          join(projectRoot, "package.json"),
          JSON.stringify({ dependencies: { react: "^18.0.0" } }),
          "utf-8"
        );

        const config = {
          docsDir: "docs",
          magsDir: "docs/.mags",
          templates: "general" as const,
          autoSessionSave: true,
          autoSessionLoad: true,
          docValidation: true,
          locale: "en",
          embedding: { provider: "local" as const },
          stack: {
            databases: ["MongoDB"], // Additional from config
          },
        };

        const result = detector.detectWithFallback(projectRoot, config);
        expect(result.frameworks).toContain("React"); // From detection
        expect(result.databases).toContain("MongoDB"); // From config
      });
    });

    describe("with CLAUDE.md", () => {
      it("parses Tech Stack section from CLAUDE.md", () => {
        // No package files, but CLAUDE.md exists
        const claudeMd = `# My Project

## Tech Stack

- **Backend:** NestJS
- **Frontend:** React
- **Database:** PostgreSQL
- **Package Manager:** pnpm
`;
        writeFileSync(join(projectRoot, "CLAUDE.md"), claudeMd, "utf-8");

        const result = detector.detectWithFallback(projectRoot);
        expect(result.frameworks).toContain("NestJS");
        expect(result.frameworks).toContain("React");
        expect(result.databases).toContain("PostgreSQL");
        expect(result.packageManager).toBe("pnpm");
      });

      it("extracts frameworks from various CLAUDE.md formats", () => {
        const claudeMd = `# Project

## Backend
We use **Express.js** with TypeScript.

## Frontend
The frontend is built with Vue.js.
`;
        writeFileSync(join(projectRoot, "CLAUDE.md"), claudeMd, "utf-8");

        const result = detector.detectWithFallback(projectRoot);
        expect(result.frameworks).toContain("Express");
        expect(result.frameworks).toContain("Vue");
        expect(result.languages).toContain("typescript");
      });

      it("handles missing Tech Stack section gracefully", () => {
        const claudeMd = `# Project

## Rules
- Follow coding standards
`;
        writeFileSync(join(projectRoot, "CLAUDE.md"), claudeMd, "utf-8");

        const result = detector.detectWithFallback(projectRoot);
        // Should return default empty-ish result
        expect(result.apiStyle).toContain("rest");
      });
    });

    describe("with docs/tech-stack.md", () => {
      it("parses tech-stack.md when other sources unavailable", () => {
        mkdirSync(join(projectRoot, "docs"), { recursive: true });
        const techDoc = `# Tech Stack

## Stack
- **Languages:** TypeScript, Python
- **Backend:** FastAPI
- **Frontend:** Next.js
- **Databases:** MongoDB, Redis
`;
        writeFileSync(join(projectRoot, "docs", "tech-stack.md"), techDoc, "utf-8");

        const result = detector.detectWithFallback(projectRoot);
        // Note: parseStackFromMarkdown extracts these via pattern matching
        expect(result.languages.map(l => l.toLowerCase())).toContain("typescript");
        expect(result.languages.map(l => l.toLowerCase())).toContain("python");
        expect(result.frameworks).toContain("FastAPI");
        expect(result.frameworks).toContain("Next.js");
        expect(result.databases).toContain("MongoDB");
        expect(result.databases).toContain("Redis");
      });

      it("checks docs/architecture/tech-stack.md as alternative path", () => {
        mkdirSync(join(projectRoot, "docs", "architecture"), { recursive: true });
        const techDoc = `# Technology Stack

## Backend
- Go with Gin framework

## Database
- PostgreSQL
`;
        writeFileSync(join(projectRoot, "docs", "architecture", "tech-stack.md"), techDoc, "utf-8");

        const result = detector.detectWithFallback(projectRoot);
        expect(result.languages).toContain("go");
        expect(result.frameworks).toContain("Gin");
        expect(result.databases).toContain("PostgreSQL");
      });
    });

    describe("fallback priority", () => {
      it("prefers file system detection over config", () => {
        // package.json says React
        writeFileSync(
          join(projectRoot, "package.json"),
          JSON.stringify({ dependencies: { react: "^18.0.0", next: "^14.0.0" } }),
          "utf-8"
        );

        // Config says Vue
        const config = {
          docsDir: "docs",
          magsDir: "docs/.mags",
          templates: "general" as const,
          autoSessionSave: true,
          autoSessionLoad: true,
          docValidation: true,
          locale: "en",
          embedding: { provider: "local" as const },
          stack: {
            frameworks: ["Vue"],
          },
        };

        const result = detector.detectWithFallback(projectRoot, config);
        // Should have React and Next.js from file system, Vue merged from config
        expect(result.frameworks).toContain("React");
        expect(result.frameworks).toContain("Next.js");
        expect(result.frameworks).toContain("Vue");
      });

      it("uses CLAUDE.md when no package files and no config", () => {
        const claudeMd = `## Tech Stack
- Django
- PostgreSQL
`;
        writeFileSync(join(projectRoot, "CLAUDE.md"), claudeMd, "utf-8");

        const result = detector.detectWithFallback(projectRoot);
        expect(result.frameworks).toContain("Django");
        expect(result.databases).toContain("PostgreSQL");
      });

      it("uses tech-stack.md as last resort", () => {
        mkdirSync(join(projectRoot, "docs"), { recursive: true });
        writeFileSync(
          join(projectRoot, "docs", "tech-stack.md"),
          "## Stack\n- Rust\n- Actix Web",
          "utf-8"
        );

        const result = detector.detectWithFallback(projectRoot);
        expect(result.languages).toContain("rust");
      });
    });

    describe("backward compatibility", () => {
      it("detect() still works without config parameter", () => {
        writeFileSync(
          join(projectRoot, "package.json"),
          JSON.stringify({ dependencies: { express: "^4.18.0" } }),
          "utf-8"
        );

        const result = detector.detect(projectRoot);
        expect(result.frameworks).toContain("Express");
      });

      it("detectWithFallback returns same result as detect for standard projects", () => {
        writeFileSync(
          join(projectRoot, "package.json"),
          JSON.stringify({
            dependencies: { react: "^18.0.0", pg: "^8.0.0" },
            devDependencies: { typescript: "^5.0.0" },
          }),
          "utf-8"
        );
        writeFileSync(join(projectRoot, "pnpm-lock.yaml"), "", "utf-8");

        const detectResult = detector.detect(projectRoot);
        const fallbackResult = detector.detectWithFallback(projectRoot);

        expect(fallbackResult.languages).toEqual(detectResult.languages);
        expect(fallbackResult.frameworks).toEqual(detectResult.frameworks);
        expect(fallbackResult.databases).toEqual(detectResult.databases);
        expect(fallbackResult.packageManager).toEqual(detectResult.packageManager);
      });
    });

    describe("parseFromClaudeMd", () => {
      it("returns null when CLAUDE.md does not exist", () => {
        const result = detector.parseFromClaudeMd(projectRoot);
        expect(result).toBeNull();
      });

      it("parses React Native correctly", () => {
        writeFileSync(
          join(projectRoot, "CLAUDE.md"),
          "## Stack\n- React Native with Expo",
          "utf-8"
        );
        const result = detector.parseFromClaudeMd(projectRoot);
        expect(result?.frameworks).toContain("React Native");
        expect(result?.frameworks).toContain("Expo");
      });

      it("handles GraphQL API style", () => {
        writeFileSync(
          join(projectRoot, "CLAUDE.md"),
          "## Stack\n- GraphQL API\n- Apollo Server",
          "utf-8"
        );
        const result = detector.parseFromClaudeMd(projectRoot);
        expect(result).not.toBeNull();
        expect(result!.apiStyle).toContain("graphql");
      });
    });

    describe("parseFromTechStackDoc", () => {
      it("returns null when no tech doc exists", () => {
        const result = detector.parseFromTechStackDoc(projectRoot);
        expect(result).toBeNull();
      });

      it("checks multiple possible paths", () => {
        // Only docs/stack.md exists (alternative path)
        mkdirSync(join(projectRoot, "docs"), { recursive: true });
        writeFileSync(
          join(projectRoot, "docs", "stack.md"),
          "## Technologies\n- Spring Boot\n- Java",
          "utf-8"
        );

        const result = detector.parseFromTechStackDoc(projectRoot);
        expect(result?.frameworks).toContain("Spring Boot");
        expect(result?.languages).toContain("java");
      });
    });
  });
});
