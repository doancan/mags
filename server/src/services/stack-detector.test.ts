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
});
