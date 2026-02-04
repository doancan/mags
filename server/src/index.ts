#!/usr/bin/env node
// ============================================
// MAGS — Memory And Guidance System
// MCP Server Entry Point
// ============================================

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = require("../package.json");

import { loadConfig, getDocsPath, getMagsPath } from "./config/loader.js";
import { DocIndexer } from "./services/doc-indexer.js";
import { MemoryStore } from "./services/memory-store.js";
import { ProgressManager } from "./services/progress-manager.js";
import { SessionManager } from "./services/session-manager.js";
import { TemplateEngine } from "./services/template-engine.js";
import { LocalEmbeddingProvider } from "./services/embedding/local.js";
import { OpenAIEmbeddingProvider } from "./services/embedding/openai.js";

import { StackDetector } from "./services/stack-detector.js";

import { registerDocTools } from "./tools/doc-tools.js";
import { registerMemoryTools } from "./tools/memory-tools.js";
import { registerProgressTools } from "./tools/progress-tools.js";
import { registerContextTools } from "./tools/context-tools.js";
import { registerValidationTools } from "./tools/validation-tools.js";
import { registerClaudeMdTools } from "./tools/claude-md-tools.js";
import { registerChangelogTools } from "./tools/changelog-tools.js";
import { registerScaffoldTools } from "./tools/scaffold-tools.js";
import { registerSessionTools } from "./tools/session-tools.js";
import { registerStackTools } from "./tools/stack-tools.js";
import { registerModuleTools } from "./tools/module-tools.js";
import { registerOrchestratorTools } from "./tools/orchestrator-tools.js";

async function main() {
  // Resolve project root
  const projectRoot =
    process.env.MAGS_PROJECT_ROOT || process.env.PROJECT_ROOT || process.cwd();

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();

  // Load configuration
  const config = loadConfig(projectRoot);
  const docsPath = getDocsPath(projectRoot, config);
  const magsPath = getMagsPath(projectRoot, config);

  // Initialize services (async to avoid blocking event loop)
  const docIndexer = new DocIndexer(docsPath);
  await docIndexer.indexAsync();

  const memoryStore = new MemoryStore(magsPath);

  // Graceful shutdown — close SQLite safely
  const shutdown = () => {
    try {
      memoryStore.close();
    } catch (err) {
      console.warn("[MAGS] Error during shutdown:", err instanceof Error ? err.message : err);
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Set up embedding provider
  if (
    config.embedding.provider === "openai" &&
    config.embedding.openaiApiKey
  ) {
    memoryStore.setEmbeddingProvider(
      new OpenAIEmbeddingProvider(
        config.embedding.openaiApiKey,
        config.embedding.openaiModel
      )
    );
  } else {
    memoryStore.setEmbeddingProvider(new LocalEmbeddingProvider());
  }

  const progressManager = new ProgressManager(magsPath);
  progressManager.load();

  const sessionManager = new SessionManager(magsPath);

  const templateEngine = new TemplateEngine(pluginRoot, {
    locale: config.locale,
    architecture: config.architecture,
    stack: config.stack?.primaryLanguage,
    apiStyle: config.stack?.apiStyle?.[0],
    customPacks: config.customTemplatePacks,
  });

  // Create MCP server
  const server = new McpServer({
    name: "mags",
    version: SERVER_VERSION,
  });

  // Register all tools
  registerDocTools(server, docIndexer, templateEngine, docsPath);
  registerMemoryTools(server, memoryStore);
  registerProgressTools(server, progressManager, memoryStore);
  registerContextTools(
    server,
    docIndexer,
    progressManager,
    sessionManager,
    memoryStore,
    config
  );
  const stackDetector = new StackDetector();
  registerValidationTools(server, docIndexer, memoryStore, progressManager, stackDetector, projectRoot);
  registerClaudeMdTools(server, docIndexer, projectRoot, config);
  registerChangelogTools(server, projectRoot);
  registerScaffoldTools(server);
  registerSessionTools(server, sessionManager, memoryStore);
  registerStackTools(server, projectRoot, config);
  registerModuleTools(server, projectRoot, config);
  registerOrchestratorTools(server, config);

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error(
    `MAGS MCP Server started — project: ${projectRoot}, docs: ${docsPath}`
  );
}

main().catch((error) => {
  console.error("MAGS MCP Server failed to start:", error);
  process.exit(1);
});
