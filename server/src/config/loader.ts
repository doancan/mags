// ============================================
// MAGS — Config Loader
// Reads .mags.yaml from project root or uses defaults
// ============================================

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { DEFAULT_CONFIG, type MagsConfig } from "../types/index.js";
import { DEFAULT_LOCALE } from "./defaults.js";

export function loadConfig(projectRoot: string): MagsConfig {
  const configPaths = [
    join(projectRoot, ".mags.yaml"),
    join(projectRoot, ".mags.yml"),
    join(projectRoot, ".mags", "config.yaml"),
    join(projectRoot, "docs", ".mags", "config.yaml"),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, "utf-8");
        const parsed = YAML.parse(raw) as Partial<MagsConfig>;
        return mergeConfig(parsed);
      } catch (err) {
        console.warn(`[ConfigLoader] Failed to parse config at ${configPath}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return { ...DEFAULT_CONFIG };
}

function mergeConfig(partial: Partial<MagsConfig>): MagsConfig {
  return {
    docsDir: partial.docsDir ?? DEFAULT_CONFIG.docsDir,
    magsDir: partial.magsDir ?? DEFAULT_CONFIG.magsDir,
    templates: partial.templates ?? DEFAULT_CONFIG.templates,
    docValidation: partial.docValidation ?? DEFAULT_CONFIG.docValidation,
    locale: partial.locale ?? DEFAULT_LOCALE,
    architecture: partial.architecture ?? undefined,
    modules: partial.modules ?? undefined,
    stack: partial.stack ?? undefined,
    customTemplatePacks: partial.customTemplatePacks ?? undefined,
    embedding: {
      provider: partial.embedding?.provider ?? DEFAULT_CONFIG.embedding.provider,
      openaiApiKey: partial.embedding?.openaiApiKey,
      openaiModel: partial.embedding?.openaiModel,
    },
  };
}

export function getDocsPath(projectRoot: string, config: MagsConfig): string {
  return join(projectRoot, config.docsDir);
}

export function getMagsPath(projectRoot: string, config: MagsConfig): string {
  return join(projectRoot, config.magsDir);
}
