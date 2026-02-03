// ============================================
// MAGS — Stack Detector
// Detects project tech stack from file system
// with fallback chain: FileSystem → Config → CLAUDE.md → TechDoc
// ============================================

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DetectedStack, MagsConfig, StackConfig } from "../types/index.js";

export class StackDetector {
  private static readonly frameworkMap: Record<string, string> = {
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
    typescript: "TypeScript",
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
    "drizzle-orm": "Drizzle ORM",
    sequelize: "Sequelize",
    knex: "Knex",
  };

  private static cleanVersion(version: string): string {
    return version.replace(/^[\^~>=<]+/, "");
  }

  extractVersions(projectRoot: string): Record<string, string> {
    const versions: Record<string, string> = {};

    // package.json
    this.extractNodeVersions(projectRoot, versions);
    // pyproject.toml
    this.extractPythonVersions(projectRoot, versions);
    // go.mod
    this.extractGoVersions(projectRoot, versions);

    return versions;
  }

  private extractNodeVersions(root: string, versions: Record<string, string>): void {
    const pkgPath = join(root, "package.json");
    if (!existsSync(pkgPath)) return;

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };

      for (const [dep, ver] of Object.entries(allDeps)) {
        const name = StackDetector.frameworkMap[dep];
        if (name && typeof ver === "string") {
          versions[name] = StackDetector.cleanVersion(ver);
        }
      }
    } catch {
      // Invalid package.json
    }
  }

  private extractPythonVersions(root: string, versions: Record<string, string>): void {
    const pyprojectPath = join(root, "pyproject.toml");
    if (!existsSync(pyprojectPath)) return;

    try {
      const content = readFileSync(pyprojectPath, "utf-8");
      const pyFrameworkMap: Record<string, string> = {
        fastapi: "FastAPI",
        django: "Django",
        flask: "Flask",
        starlette: "Starlette",
        celery: "Celery",
      };

      for (const [pkg, name] of Object.entries(pyFrameworkMap)) {
        // Match patterns like: fastapi = ">=0.100.0" or fastapi = "^0.100.0"
        const regex = new RegExp(`${pkg}\\s*[=><!~]+\\s*["']?([\\d.]+)`, "i");
        const match = content.match(regex);
        if (match) {
          versions[name] = StackDetector.cleanVersion(match[1]);
        }
      }
    } catch {
      // ignore
    }
  }

  private extractGoVersions(root: string, versions: Record<string, string>): void {
    const goModPath = join(root, "go.mod");
    if (!existsSync(goModPath)) return;

    try {
      const content = readFileSync(goModPath, "utf-8");
      const goFrameworkMap: Record<string, string> = {
        "gin-gonic/gin": "Gin",
        "labstack/echo": "Echo",
        "gofiber/fiber": "Fiber",
        "go-chi/chi": "Chi",
      };

      for (const [pkg, name] of Object.entries(goFrameworkMap)) {
        const regex = new RegExp(`${pkg.replace(/\//g, "\\/")}\\s+v([\\d.]+)`, "i");
        const match = content.match(regex);
        if (match) {
          versions[name] = match[1];
        }
      }
    } catch {
      // ignore
    }
  }

  detect(projectRoot: string): DetectedStack {
    const result: DetectedStack = {
      languages: [],
      frameworks: [],
      databases: [],
      apiStyle: [],
      packageManager: "",
      versions: {},
    };

    this.detectNode(projectRoot, result);
    this.detectPython(projectRoot, result);
    this.detectGo(projectRoot, result);
    this.detectRust(projectRoot, result);
    this.detectJava(projectRoot, result);
    this.detectApiStyle(projectRoot, result);
    this.detectDatabases(projectRoot, result);
    result.versions = this.extractVersions(projectRoot);

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
      } as const;

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

  // ============================================
  // Fallback Chain Methods
  // ============================================

  /**
   * Check if a DetectedStack is effectively empty (no useful data)
   */
  private isEmpty(stack: DetectedStack): boolean {
    return (
      stack.languages.length === 0 &&
      stack.frameworks.length === 0 &&
      stack.databases.length === 0 &&
      stack.packageManager === "" &&
      (stack.apiStyle.length === 0 || (stack.apiStyle.length === 1 && stack.apiStyle[0] === "rest"))
    );
  }

  /**
   * Merge two stacks, preferring values from 'primary' but filling gaps from 'fallback'
   */
  private mergeStacks(primary: DetectedStack, fallback: DetectedStack): DetectedStack {
    return {
      languages: primary.languages.length > 0 ? primary.languages : fallback.languages,
      frameworks: [...new Set([...primary.frameworks, ...fallback.frameworks])],
      databases: [...new Set([...primary.databases, ...fallback.databases])],
      apiStyle: primary.apiStyle.length > 0 ? primary.apiStyle : fallback.apiStyle,
      packageManager: primary.packageManager || fallback.packageManager,
      versions: { ...fallback.versions, ...primary.versions },
    };
  }

  /**
   * Detect stack with fallback chain:
   * 1. File system detection (package.json, etc.)
   * 2. .mags.yaml config (always merged to supplement detection)
   * 3. CLAUDE.md parsing (only if file system detection is empty)
   * 4. docs/tech-stack.md parsing (only if still empty)
   */
  detectWithFallback(projectRoot: string, config?: MagsConfig): DetectedStack {
    // 1. Primary: File system detection
    let result = this.detect(projectRoot);

    // 2. Config merge: Always merge config.stack to supplement detection
    if (config?.stack) {
      const configStack = this.stackConfigToDetectedStack(config.stack);
      if (configStack) {
        result = this.mergeStacks(result, configStack);
      }
    }

    // 3. Fallback: CLAUDE.md parsing (only if detection is empty)
    if (this.isEmpty(result)) {
      const claudeStack = this.parseFromClaudeMd(projectRoot);
      if (claudeStack) {
        result = this.mergeStacks(result, claudeStack);
      }
    }

    // 4. Fallback: docs/tech-stack.md parsing (only if still empty)
    if (this.isEmpty(result)) {
      const techDocStack = this.parseFromTechStackDoc(projectRoot);
      if (techDocStack) {
        result = this.mergeStacks(result, techDocStack);
      }
    }

    return result;
  }

  /**
   * Convert StackConfig from .mags.yaml to DetectedStack
   */
  private stackConfigToDetectedStack(stackConfig: StackConfig): DetectedStack | null {
    if (!stackConfig) return null;

    const result: DetectedStack = {
      languages: [],
      frameworks: [],
      databases: [],
      apiStyle: [],
      packageManager: stackConfig.packageManager ?? "",
      versions: {},
    };

    // Primary language
    if (stackConfig.primaryLanguage) {
      result.languages.push(stackConfig.primaryLanguage);
    }

    // Additional languages
    if (stackConfig.languages) {
      for (const lang of stackConfig.languages) {
        if (!result.languages.includes(lang)) {
          result.languages.push(lang);
        }
      }
    }

    // Frameworks
    if (stackConfig.frameworks) {
      result.frameworks.push(...stackConfig.frameworks);
    }

    // Databases
    if (stackConfig.databases) {
      result.databases.push(...stackConfig.databases);
    }

    // API Style
    if (stackConfig.apiStyle) {
      result.apiStyle.push(...stackConfig.apiStyle);
    }

    return result;
  }

  /**
   * Parse tech stack from CLAUDE.md file
   */
  parseFromClaudeMd(projectRoot: string): DetectedStack | null {
    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    if (!existsSync(claudeMdPath)) return null;

    try {
      const content = readFileSync(claudeMdPath, "utf-8");
      return this.parseStackFromMarkdown(content);
    } catch (err) {
      console.warn("[StackDetector] Failed to parse CLAUDE.md:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Parse tech stack from docs/tech-stack.md or docs/architecture/tech-stack.md
   */
  parseFromTechStackDoc(projectRoot: string): DetectedStack | null {
    const possiblePaths = [
      join(projectRoot, "docs", "tech-stack.md"),
      join(projectRoot, "docs", "architecture", "tech-stack.md"),
      join(projectRoot, "docs", "stack.md"),
    ];

    for (const docPath of possiblePaths) {
      if (!existsSync(docPath)) continue;
      try {
        const content = readFileSync(docPath, "utf-8");
        return this.parseStackFromMarkdown(content);
      } catch (err) {
        console.warn(`[StackDetector] Failed to parse ${docPath}:`, err instanceof Error ? err.message : err);
      }
    }

    return null;
  }

  /**
   * Parse stack information from markdown content
   * Looks for "Tech Stack", "Stack", "Backend", "Frontend" sections
   */
  private parseStackFromMarkdown(content: string): DetectedStack | null {
    const result: DetectedStack = {
      languages: [],
      frameworks: [],
      databases: [],
      apiStyle: [],
      packageManager: "",
      versions: {},
    };

    // Find Tech Stack section
    const techStackMatch = content.match(/##\s*(Tech Stack|Stack|Technologies)[\s\S]*?(?=\n##\s|\n#\s|$)/i);
    const backendMatch = content.match(/##\s*(Backend|Server)[\s\S]*?(?=\n##\s|\n#\s|$)/i);
    const frontendMatch = content.match(/##\s*(Frontend|Client|UI)[\s\S]*?(?=\n##\s|\n#\s|$)/i);
    const databaseMatch = content.match(/##\s*(Database|Data|Storage)[\s\S]*?(?=\n##\s|\n#\s|$)/i);

    const sections = [
      techStackMatch?.[0],
      backendMatch?.[0],
      frontendMatch?.[0],
      databaseMatch?.[0],
    ].filter(Boolean).join("\n");

    if (!sections) {
      // Try to find inline tech stack mentions
      const allContent = content;
      this.extractTechFromText(allContent, result);
    } else {
      this.extractTechFromText(sections, result);
    }

    // Return null if nothing useful was found
    const hasUsefulData =
      result.languages.length > 0 ||
      result.frameworks.length > 0 ||
      result.databases.length > 0 ||
      result.packageManager !== "" ||
      result.apiStyle.length > 0;

    if (!hasUsefulData) return null;

    return result;
  }

  /**
   * Extract tech stack items from text using pattern matching
   */
  private extractTechFromText(text: string, result: DetectedStack): void {
    // Framework patterns: "- **Backend:** NestJS" or "Backend: NestJS" or just "NestJS"
    const frameworkPatterns: [RegExp, string, "framework" | "language" | "database"][] = [
      // Frameworks
      [/\bNestJS\b/i, "NestJS", "framework"],
      [/\bNext\.?js\b/i, "Next.js", "framework"],
      [/\bReact\b(?!\s*Native)/i, "React", "framework"],
      [/\bReact\s*Native\b/i, "React Native", "framework"],
      [/\bVue\.?js?\b/i, "Vue", "framework"],
      [/\bAngular\b/i, "Angular", "framework"],
      [/\bSvelte\b/i, "Svelte", "framework"],
      [/\bExpress\.?js?\b/i, "Express", "framework"],
      [/\bFastify\b/i, "Fastify", "framework"],
      [/\bHono\b/i, "Hono", "framework"],
      [/\bFastAPI\b/i, "FastAPI", "framework"],
      [/\bDjango\b/i, "Django", "framework"],
      [/\bFlask\b/i, "Flask", "framework"],
      [/\bSpring\s*Boot\b/i, "Spring Boot", "framework"],
      [/\bGin\b/i, "Gin", "framework"],
      [/\bAstro\b/i, "Astro", "framework"],
      [/\bRemix\b/i, "Remix", "framework"],
      [/\bExpo\b/i, "Expo", "framework"],
      // Languages
      [/\bTypeScript\b/i, "typescript", "language"],
      [/\bJavaScript\b/i, "javascript", "language"],
      [/\bPython\b/i, "python", "language"],
      [/\bGo(?:lang)?\b/i, "go", "language"],
      [/\bRust\b/i, "rust", "language"],
      [/\bJava\b(?!\s*Script)/i, "java", "language"],
      // Databases
      [/\bPostgreSQL\b|\bPostgres\b/i, "PostgreSQL", "database"],
      [/\bMySQL\b/i, "MySQL", "database"],
      [/\bMongoDB\b/i, "MongoDB", "database"],
      [/\bRedis\b/i, "Redis", "database"],
      [/\bSQLite\b/i, "SQLite", "database"],
      [/\bElasticsearch\b/i, "Elasticsearch", "database"],
      // ORMs (as database tools)
      [/\bPrisma\b/i, "Prisma ORM", "database"],
      [/\bTypeORM\b/i, "TypeORM", "database"],
      [/\bDrizzle\b/i, "Drizzle ORM", "database"],
    ];

    for (const [pattern, name, type] of frameworkPatterns) {
      if (pattern.test(text)) {
        if (type === "framework" && !result.frameworks.includes(name)) {
          result.frameworks.push(name);
        } else if (type === "language" && !result.languages.includes(name)) {
          result.languages.push(name);
        } else if (type === "database" && !result.databases.includes(name)) {
          result.databases.push(name);
        }
      }
    }

    // Package manager detection
    const pmPatterns: [RegExp, string][] = [
      [/\bpnpm\b/i, "pnpm"],
      [/\byarn\b/i, "yarn"],
      [/\bnpm\b/i, "npm"],
      [/\bbun\b/i, "bun"],
      [/\bpoetry\b/i, "poetry"],
      [/\bcargo\b/i, "cargo"],
    ];

    for (const [pattern, pm] of pmPatterns) {
      if (pattern.test(text) && !result.packageManager) {
        result.packageManager = pm;
      }
    }

    // API style detection
    if (/\bGraphQL\b/i.test(text) && !result.apiStyle.includes("graphql")) {
      result.apiStyle.push("graphql");
    }
    if (/\bgRPC\b/i.test(text) && !result.apiStyle.includes("grpc")) {
      result.apiStyle.push("grpc");
    }
    if (/\bREST\b/i.test(text) && !result.apiStyle.includes("rest")) {
      result.apiStyle.push("rest");
    }
  }
}
