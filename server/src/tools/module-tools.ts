// ============================================
// MAGS — Module Tools
// MCP tool handlers for module discovery
// ============================================

import { z } from "zod";
import { ModuleDiscoverer } from "../services/module-discoverer.js";
import type { MagsConfig } from "../types/index.js";

export function registerModuleTools(
  server: any,
  projectRoot: string,
  config: MagsConfig
) {
  const discoverer = new ModuleDiscoverer();

  // --- mags_discover_modules ---
  server.tool(
    "mags_discover_modules",
    "Discover modules in the project by scanning the directory structure. Returns detected modules with confidence scores.",
    {},
    async () => {
      const modules = discoverer.discover(projectRoot, config.architecture);

      if (modules.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                discovered: false,
                modules: [],
                message: "No modules detected. The project may use a non-standard structure, or modules may not be organized into subdirectories.",
              }, null, 2),
            },
          ],
        };
      }

      // Format as .mags.yaml suggestion
      const yamlSuggestion = modules.map((m) => ({
        name: m.name,
        aliases: [m.name],
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                discovered: true,
                count: modules.length,
                modules,
                yamlSuggestion: `modules:\n${yamlSuggestion.map((m) => `  - name: ${m.name}\n    aliases: [${m.aliases.join(", ")}]`).join("\n")}`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
