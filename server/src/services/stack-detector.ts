// ============================================
// MAGS — Stack Detector
// Detects project tech stack from file system
// ============================================

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DetectedStack } from "../types/index.js";

export class StackDetector {
  detect(projectRoot: string): DetectedStack {
    const result: DetectedStack = {
      languages: [],
      frameworks: [],
      databases: [],
      apiStyle: [],
      packageManager: "",
    };

    this.detectNode(projectRoot, result);
    this.detectPython(projectRoot, result);
    this.detectGo(projectRoot, result);
    this.detectRust(projectRoot, result);
    this.detectJava(projectRoot, result);
    this.detectApiStyle(projectRoot, result);
    this.detectDatabases(projectRoot, result);

    return result;
  }

  private detectNode(root: string, result: DetectedStack): void {
    const pkgPath = join(root, "package.json");
    if (!existsSync(pkgPath)) return;

    result.languages.push("typescript/javascript");

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };

      // Package manager
      if (existsSync(join(root, "pnpm-lock.yaml"))) {
        result.packageManager = "pnpm";
      } else if (existsSync(join(root, "yarn.lock"))) {
        result.packageManager = "yarn";
      } else if (existsSync(join(root, "bun.lockb"))) {
        result.packageManager = "bun";
      } else {
        result.packageManager = "npm";
      }

      // Frameworks
      const frameworkMap: Record<string, string> = {
        next: "Next.js",
        nuxt: "Nuxt",
        react: "React",
        vue: "Vue",
        angular: "Angular",
        svelte: "Svelte",
        "@nestjs/core": "NestJS",
        express: "Express",
        fastify: "Fastify",
        hono: "Hono",
        "@hono/hono": "Hono",
        "react-native": "React Native",
        expo: "Expo",
        electron: "Electron",
        astro: "Astro",
        remix: "Remix",
      };

      for (const [dep, name] of Object.entries(frameworkMap)) {
        if (allDeps[dep]) {
          result.frameworks.push(name);
        }
      }

      // TypeScript check
      if (allDeps.typescript || existsSync(join(root, "tsconfig.json"))) {
        if (!result.languages.includes("typescript")) {
          result.languages[0] = "typescript";
        }
      }

      // Database from dependencies
      const dbMap: Record<string, string> = {
        pg: "PostgreSQL",
        mysql2: "MySQL",
        "better-sqlite3": "SQLite",
        mongodb: "MongoDB",
        mongoose: "MongoDB",
        redis: "Redis",
        ioredis: "Redis",
        prisma: "Prisma ORM",
        "@prisma/client": "Prisma ORM",
        typeorm: "TypeORM",
        drizzle: "Drizzle ORM",
        "drizzle-orm": "Drizzle ORM",
        sequelize: "Sequelize",
        knex: "Knex",
      };

      for (const [dep, name] of Object.entries(dbMap)) {
        if (allDeps[dep] && !result.databases.includes(name)) {
          result.databases.push(name);
        }
      }
    } catch {
      // Invalid package.json
    }
  }

  private detectPython(root: string, result: DetectedStack): void {
    const hasPyproject = existsSync(join(root, "pyproject.toml"));
    const hasRequirements = existsSync(join(root, "requirements.txt"));
    const hasSetupPy = existsSync(join(root, "setup.py"));

    if (!hasPyproject && !hasRequirements && !hasSetupPy) return;

    result.languages.push("python");

    // Package manager
    if (hasPyproject) {
      try {
        const content = readFileSync(join(root, "pyproject.toml"), "utf-8");
        if (content.includes("[tool.poetry]")) {
          result.packageManager = result.packageManager || "poetry";
        } else if (content.includes("[tool.uv]") || content.includes("uv.lock")) {
          result.packageManager = result.packageManager || "uv";
        } else {
          result.packageManager = result.packageManager || "pip";
        }

        // Frameworks from pyproject.toml
        const frameworkPatterns: [RegExp, string][] = [
          [/fastapi/i, "FastAPI"],
          [/django/i, "Django"],
          [/flask/i, "Flask"],
          [/starlette/i, "Starlette"],
          [/litestar/i, "Litestar"],
          [/celery/i, "Celery"],
        ];
        for (const [pattern, name] of frameworkPatterns) {
          if (pattern.test(content)) {
            result.frameworks.push(name);
          }
        }
      } catch {
        // ignore
      }
    }

    if (hasRequirements) {
      try {
        const content = readFileSync(join(root, "requirements.txt"), "utf-8");
        const frameworkPatterns: [RegExp, string][] = [
          [/^fastapi/im, "FastAPI"],
          [/^django/im, "Django"],
          [/^flask/im, "Flask"],
          [/^starlette/im, "Starlette"],
          [/^celery/im, "Celery"],
        ];
        for (const [pattern, name] of frameworkPatterns) {
          if (pattern.test(content) && !result.frameworks.includes(name)) {
            result.frameworks.push(name);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  private detectGo(root: string, result: DetectedStack): void {
    const goModPath = join(root, "go.mod");
    if (!existsSync(goModPath)) return;

    result.languages.push("go");
    result.packageManager = result.packageManager || "go modules";

    try {
      const content = readFileSync(goModPath, "utf-8");
      const frameworkPatterns: [RegExp, string][] = [
        [/gin-gonic\/gin/, "Gin"],
        [/labstack\/echo/, "Echo"],
        [/gofiber\/fiber/, "Fiber"],
        [/gorilla\/mux/, "Gorilla Mux"],
        [/go-chi\/chi/, "Chi"],
      ];
      for (const [pattern, name] of frameworkPatterns) {
        if (pattern.test(content)) {
          result.frameworks.push(name);
        }
      }
    } catch {
      // ignore
    }
  }

  private detectRust(root: string, result: DetectedStack): void {
    const cargoPath = join(root, "Cargo.toml");
    if (!existsSync(cargoPath)) return;

    result.languages.push("rust");
    result.packageManager = result.packageManager || "cargo";

    try {
      const content = readFileSync(cargoPath, "utf-8");
      const frameworkPatterns: [RegExp, string][] = [
        [/actix-web/, "Actix Web"],
        [/axum/, "Axum"],
        [/rocket/, "Rocket"],
        [/warp/, "Warp"],
        [/tokio/, "Tokio"],
        [/diesel/, "Diesel"],
        [/sqlx/, "SQLx"],
      ];
      for (const [pattern, name] of frameworkPatterns) {
        if (pattern.test(content)) {
          result.frameworks.push(name);
        }
      }
    } catch {
      // ignore
    }
  }

  private detectJava(root: string, result: DetectedStack): void {
    const hasPom = existsSync(join(root, "pom.xml"));
    const hasGradle = existsSync(join(root, "build.gradle")) || existsSync(join(root, "build.gradle.kts"));

    if (!hasPom && !hasGradle) return;

    result.languages.push("java");
    result.packageManager = result.packageManager || (hasPom ? "maven" : "gradle");

    const filesToCheck = [
      hasPom ? join(root, "pom.xml") : null,
      existsSync(join(root, "build.gradle")) ? join(root, "build.gradle") : null,
      existsSync(join(root, "build.gradle.kts")) ? join(root, "build.gradle.kts") : null,
    ].filter(Boolean) as string[];

    for (const filePath of filesToCheck) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const frameworkPatterns: [RegExp, string][] = [
          [/spring-boot/, "Spring Boot"],
          [/quarkus/, "Quarkus"],
          [/micronaut/, "Micronaut"],
          [/jakarta/, "Jakarta EE"],
        ];
        for (const [pattern, name] of frameworkPatterns) {
          if (pattern.test(content) && !result.frameworks.includes(name)) {
            result.frameworks.push(name);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  private detectApiStyle(root: string, result: DetectedStack): void {
    // GraphQL
    if (
      existsSync(join(root, "schema.graphql")) ||
      existsSync(join(root, ".graphqlrc")) ||
      existsSync(join(root, ".graphqlrc.yml")) ||
      existsSync(join(root, ".graphqlrc.yaml")) ||
      existsSync(join(root, "codegen.yml")) ||
      existsSync(join(root, "codegen.yaml")) ||
      existsSync(join(root, "codegen.ts"))
    ) {
      result.apiStyle.push("graphql");
    }

    // Check package.json for GraphQL deps
    const pkgPath = join(root, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (allDeps.graphql || allDeps["@apollo/server"] || allDeps["apollo-server"]) {
          if (!result.apiStyle.includes("graphql")) result.apiStyle.push("graphql");
        }
        if (allDeps["@grpc/grpc-js"] || allDeps.grpc) {
          if (!result.apiStyle.includes("grpc")) result.apiStyle.push("grpc");
        }
        if (allDeps.kafkajs || allDeps.amqplib || allDeps.bullmq) {
          if (!result.apiStyle.includes("event-driven")) result.apiStyle.push("event-driven");
        }
      } catch {
        // ignore
      }
    }

    // Proto files for gRPC
    try {
      const files = readdirSync(root);
      if (files.some((f: string) => f.endsWith(".proto"))) {
        if (!result.apiStyle.includes("grpc")) result.apiStyle.push("grpc");
      }
    } catch {
      // ignore
    }

    // Docker compose for microservices signal
    if (
      existsSync(join(root, "docker-compose.yml")) ||
      existsSync(join(root, "docker-compose.yaml"))
    ) {
      // This is more of an infrastructure signal, not adding to apiStyle
    }

    // Default to REST if nothing detected
    if (result.apiStyle.length === 0) {
      result.apiStyle.push("rest");
    }
  }

  private detectDatabases(root: string, result: DetectedStack): void {
    // Check docker-compose for databases
    const composePaths = [
      join(root, "docker-compose.yml"),
      join(root, "docker-compose.yaml"),
    ];

    for (const composePath of composePaths) {
      if (!existsSync(composePath)) continue;
      try {
        const content = readFileSync(composePath, "utf-8");
        const dbPatterns: [RegExp, string][] = [
          [/postgres/i, "PostgreSQL"],
          [/mysql/i, "MySQL"],
          [/mongo/i, "MongoDB"],
          [/redis/i, "Redis"],
          [/elasticsearch/i, "Elasticsearch"],
          [/rabbitmq/i, "RabbitMQ"],
          [/kafka/i, "Kafka"],
        ];
        for (const [pattern, name] of dbPatterns) {
          if (pattern.test(content) && !result.databases.includes(name)) {
            result.databases.push(name);
          }
        }
      } catch {
        // ignore
      }
    }
  }
}
