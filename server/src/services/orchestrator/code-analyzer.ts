// ============================================
// MAGS — Code Analyzer (Deep Analysis)
// ============================================

import * as fs from "fs";
import * as path from "path";
import type {
  CodeAnalysisResult,
  DiscoveredModule,
  DiscoveredEndpoint,
  DiscoveredTable,
  TechDebtItem,
  ReversePrd,
  DependencyNode,
} from "../../types/orchestrator.js";

// --- Patterns ---

const PATTERNS = {
  // Module directories - common patterns in various project structures
  moduleDirs: [
    "src/modules",
    "src/features",
    "src/domains",
    "src/legacy",      // Legacy code directories
    "src/components",  // Frontend components
    "src/services",    // Service-based architecture
    "src/api",         // API modules
    "lib",
    "packages",
    "apps",
  ],

  // Controller/Route patterns
  endpoints: {
    nestjs: /@(Get|Post|Patch|Put|Delete)\s*\(\s*['"`]([^'"`]*)['"`]?\s*\)/g,
    express: /\.(get|post|patch|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  },

  // Model/Entity patterns
  models: {
    prisma: /model\s+(\w+)\s*\{([^}]+)\}/g,
    typeorm: /@Entity\s*\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/g,
  },

  // Tech debt markers (no global flag - we process line by line)
  techDebt: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|DEPRECATED)[\s:]*(.+)/i,

  // Import analysis
  imports: /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
};

// --- Code Analyzer Class ---

export class CodeAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Perform deep analysis of codebase
   */
  async analyze(): Promise<CodeAnalysisResult> {
    const modules = await this.discoverModules();
    const endpoints = await this.discoverEndpoints();
    const tables = await this.discoverTables();
    const techDebt = await this.findTechDebt();
    const stack = await this.detectStack();
    const patterns = this.detectPatterns(modules);
    const conventions = this.detectConventions();

    return {
      timestamp: new Date().toISOString(),
      projectName: this.getProjectName(),
      stack,
      modules,
      endpoints,
      tables,
      techDebt,
      testCoverage: await this.estimateTestCoverage(),
      patterns,
      conventions,
    };
  }

  /**
   * Generate Reverse PRD from analysis
   */
  async generateReversePrd(): Promise<ReversePrd> {
    const analysis = await this.analyze();

    const modules = analysis.modules.map((m, idx) => ({
      id: `M${idx + 1}`,
      name: m.name,
      confidence: m.confidence,
      existingFeatures: m.endpoints.map((e, fidx) => ({
        id: `M${idx + 1}-${String(fidx + 1).padStart(3, "0")}`,
        name: `${e.method} ${e.path}`,
        status: "complete" as const,
        files: [e.file],
      })),
      missingFeatures: this.identifyMissingFeatures(m),
      techDebt: analysis.techDebt.filter((td) =>
        m.files.some((f) => td.file.includes(f))
      ),
    }));

    const dependencyGraph = this.buildDependencyGraph(analysis.modules);

    return {
      generatedAt: new Date().toISOString(),
      source: "analysis",
      project: {
        name: analysis.projectName,
        overview: `Auto-generated from codebase analysis. Found ${analysis.modules.length} modules, ${analysis.endpoints.length} endpoints, ${analysis.tables.length} tables.`,
      },
      stack: analysis.stack,
      modules,
      dependencyGraph,
      recommendations: this.generateRecommendations(analysis),
    };
  }

  // --- Discovery Methods ---

  private async discoverModules(): Promise<DiscoveredModule[]> {
    const modules: DiscoveredModule[] = [];

    for (const baseDir of PATTERNS.moduleDirs) {
      const fullPath = path.join(this.projectRoot, baseDir);
      if (!fs.existsSync(fullPath)) continue;

      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

        const modulePath = path.join(fullPath, entry.name);
        const files = this.getFilesRecursive(modulePath);
        const endpoints = await this.findEndpointsInFiles(files);
        const tables = await this.findTablesInFiles(files);

        modules.push({
          name: entry.name,
          path: modulePath,
          confidence: this.calculateConfidence(files, endpoints, tables),
          files: files.map((f) => path.relative(this.projectRoot, f)),
          endpoints,
          tables,
        });
      }
    }

    return modules;
  }

  private async discoverEndpoints(): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];
    const files = this.getFilesRecursive(this.projectRoot, [".ts", ".js"]);

    for (const file of files) {
      const found = await this.findEndpointsInFile(file);
      endpoints.push(...found);
    }

    return endpoints;
  }

  private async discoverTables(): Promise<DiscoveredTable[]> {
    const tables: DiscoveredTable[] = [];

    // Check Prisma schema
    const prismaPath = path.join(this.projectRoot, "prisma", "schema.prisma");
    if (fs.existsSync(prismaPath)) {
      const content = fs.readFileSync(prismaPath, "utf-8");
      const matches = [...content.matchAll(PATTERNS.models.prisma)];

      for (const match of matches) {
        const name = match[1];
        const body = match[2];
        const columns = body
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
          .map((l) => l.split(/\s+/)[0])
          .filter(Boolean);

        tables.push({
          name,
          columns,
          file: prismaPath,
          relations: this.extractRelations(body),
        });
      }
    }

    return tables;
  }

  private async findTechDebt(): Promise<TechDebtItem[]> {
    const items: TechDebtItem[] = [];
    const files = this.getFilesRecursive(this.projectRoot, [".ts", ".js", ".tsx", ".jsx"]);

    for (const file of files) {
      if (file.includes("node_modules")) continue;

      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, idx) => {
          const match = line.match(PATTERNS.techDebt);
          if (match) {
            items.push({
              type: match[1].toLowerCase() as TechDebtItem["type"],
              message: match[2]?.trim() || "",
              file: path.relative(this.projectRoot, file),
              line: idx + 1,
            });
          }
        });
      } catch (err) {
        console.warn(`[CodeAnalyzer] Failed to read file for tech debt scan: ${file}:`, err instanceof Error ? err.message : err);
      }
    }

    return items;
  }

  // --- Helper Methods ---

  private async findEndpointsInFiles(files: string[]): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];
    for (const file of files) {
      const found = await this.findEndpointsInFile(file);
      endpoints.push(...found);
    }
    return endpoints;
  }

  private async findEndpointsInFile(file: string): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];

    if (!file.endsWith(".ts") && !file.endsWith(".js")) return endpoints;

    try {
      const content = fs.readFileSync(file, "utf-8");

      // Extract NestJS Controller prefix if present
      const controllerMatch = content.match(/@Controller\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/);
      const controllerPrefix = controllerMatch?.[1] || "";

      // NestJS
      const nestMatches = [...content.matchAll(PATTERNS.endpoints.nestjs)];
      for (const match of nestMatches) {
        const routePath = match[2] || "";
        // Combine controller prefix with route path
        const fullPath = this.combineNestPaths(controllerPrefix, routePath);
        endpoints.push({
          method: match[1].toUpperCase(),
          path: fullPath,
          file: path.relative(this.projectRoot, file),
          line: this.getLineNumber(content, match.index || 0),
          handler: this.extractHandlerName(content, match.index || 0),
        });
      }

      // Express
      const expressMatches = [...content.matchAll(PATTERNS.endpoints.express)];
      for (const match of expressMatches) {
        endpoints.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: path.relative(this.projectRoot, file),
          line: this.getLineNumber(content, match.index || 0),
          handler: "anonymous",
        });
      }
    } catch (err) {
      console.warn(`[CodeAnalyzer] Failed to parse endpoints in ${file}:`, err instanceof Error ? err.message : err);
    }

    return endpoints;
  }

  private async findTablesInFiles(_files: string[]): Promise<DiscoveredTable[]> {
    // Tables are usually in schema files, not module files
    return [];
  }

  private async detectStack(): Promise<CodeAnalysisResult["stack"]> {
    const stack = {
      languages: [] as string[],
      frameworks: [] as string[],
      databases: [] as string[],
    };

    // Check package.json
    const pkgPath = path.join(this.projectRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      stack.languages.push("typescript", "javascript");

      if (deps["@nestjs/core"]) stack.frameworks.push("nestjs");
      if (deps["express"]) stack.frameworks.push("express");
      if (deps["react"]) stack.frameworks.push("react");
      if (deps["next"]) stack.frameworks.push("nextjs");
      if (deps["prisma"] || deps["@prisma/client"]) stack.frameworks.push("prisma");
      if (deps["pg"] || deps["postgres"]) stack.databases.push("postgresql");
      if (deps["mysql"] || deps["mysql2"]) stack.databases.push("mysql");
      if (deps["mongodb"]) stack.databases.push("mongodb");
    }

    return stack;
  }

  private getProjectName(): string {
    const pkgPath = path.join(this.projectRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return pkg.name || path.basename(this.projectRoot);
    }
    return path.basename(this.projectRoot);
  }

  private getFilesRecursive(dir: string, extensions?: string[]): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) return files;

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return files;
  }

  private calculateConfidence(
    files: string[],
    endpoints: DiscoveredEndpoint[],
    _tables: DiscoveredTable[]
  ): number {
    let score = 50; // Base score

    // Has index/main file
    if (files.some((f) => f.includes("index.") || f.includes(".module."))) {
      score += 20;
    }

    // Has endpoints
    if (endpoints.length > 0) score += 15;

    // Has multiple files (not just one)
    if (files.length > 3) score += 15;

    return Math.min(100, score);
  }

  private extractRelations(body: string): string[] {
    const relations: string[] = [];
    const lines = body.split("\n");

    for (const line of lines) {
      if (line.includes("@relation") || line.includes("references:")) {
        const match = line.match(/(\w+)\s+\w+/);
        if (match) relations.push(match[1]);
      }
    }

    return relations;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split("\n").length;
  }

  private extractHandlerName(content: string, index: number): string {
    const after = content.substring(index);
    const match = after.match(/\)\s*\n?\s*(?:async\s+)?(\w+)\s*\(/);
    return match?.[1] || "handler";
  }

  private combineNestPaths(prefix: string, routePath: string): string {
    // Normalize paths - remove leading/trailing slashes
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
    const cleanRoute = routePath.replace(/^\/+|\/+$/g, "");

    // Combine paths
    if (!cleanPrefix && !cleanRoute) {
      return "/";
    }
    if (!cleanPrefix) {
      return "/" + cleanRoute;
    }
    if (!cleanRoute) {
      return "/" + cleanPrefix;
    }
    return "/" + cleanPrefix + "/" + cleanRoute;
  }

  private detectPatterns(modules: DiscoveredModule[]): string[] {
    const patterns: string[] = [];

    for (const module of modules) {
      if (module.files.some((f) => f.includes(".repository."))) {
        patterns.push("repository-pattern");
      }
      if (module.files.some((f) => f.includes(".service."))) {
        patterns.push("service-layer");
      }
      if (module.files.some((f) => f.includes(".controller."))) {
        patterns.push("controller-pattern");
      }
    }

    return [...new Set(patterns)];
  }

  private detectConventions(): Record<string, string> {
    return {
      fileNaming: "kebab-case",
      folderStructure: "feature-based",
    };
  }

  private async estimateTestCoverage(): Promise<number> {
    const srcFiles = this.getFilesRecursive(path.join(this.projectRoot, "src"), [".ts", ".tsx"]);
    const testFiles = srcFiles.filter(
      (f) => f.includes(".test.") || f.includes(".spec.")
    );

    const srcCount = srcFiles.filter((f) => !f.includes(".test.") && !f.includes(".spec.")).length;
    if (srcCount === 0) return 0;

    return Math.round((testFiles.length / srcCount) * 100);
  }

  private identifyMissingFeatures(module: DiscoveredModule): string[] {
    const missing: string[] = [];

    // Check for common CRUD endpoints
    const methods = module.endpoints.map((e) => e.method);
    if (!methods.includes("GET")) missing.push("List endpoint (GET)");
    if (!methods.includes("POST")) missing.push("Create endpoint (POST)");
    if (!methods.includes("PATCH") && !methods.includes("PUT")) {
      missing.push("Update endpoint (PATCH/PUT)");
    }
    if (!methods.includes("DELETE")) missing.push("Delete endpoint (DELETE)");

    return missing;
  }

  private buildDependencyGraph(modules: DiscoveredModule[]): DependencyNode[] {
    // Simple dependency analysis based on imports
    return modules.map((m) => ({
      module: m.name,
      dependsOn: [],
      blockedBy: [],
    }));
  }

  private generateRecommendations(analysis: CodeAnalysisResult): string[] {
    const recs: string[] = [];

    if (analysis.testCoverage < 50) {
      recs.push(`Increase test coverage (current: ${analysis.testCoverage}%, target: 80%)`);
    }

    if (analysis.techDebt.length > 10) {
      recs.push(`Address tech debt (${analysis.techDebt.length} items found)`);
    }

    for (const module of analysis.modules) {
      if (module.confidence < 70) {
        recs.push(`Review module "${module.name}" structure (confidence: ${module.confidence}%)`);
      }
    }

    return recs;
  }
}

// --- Factory ---

export function createCodeAnalyzer(projectRoot?: string): CodeAnalyzer {
  return new CodeAnalyzer(projectRoot);
}
