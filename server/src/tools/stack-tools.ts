// ============================================
// MAGS — Stack Tools
// MCP tool handlers for stack detection
// ============================================

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StackDetector } from "../services/stack-detector.js";
import type { MagsConfig } from "../types/index.js";

export function registerStackTools(server: McpServer, projectRoot: string, config?: MagsConfig) {
  const detector = new StackDetector();

  // --- mags_detect_stack ---
  server.tool(
    "mags_detect_stack",
    "Detect the project's tech stack by scanning project files. Returns detected languages, frameworks, databases, API style, and package manager.",
    {},
    async () => {
      // First check if stack is pre-configured in .mags.yaml
      if (config?.stack && Object.keys(config.stack).length > 0) {
        const configStack = config.stack;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  detected: false,
                  source: "config",
                  stack: {
                    languages: configStack.languages || (configStack.primaryLanguage ? [configStack.primaryLanguage] : []),
                    frameworks: configStack.frameworks || [],
                    databases: configStack.databases || [],
                    apiStyle: configStack.apiStyle || [],
                    packageManager: configStack.packageManager || "",
                  },
                  note: "Stack loaded from .mags.yaml configuration.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Fallback: detect from filesystem with full fallback chain
      // Uses: FileSystem → Config → CLAUDE.md → TechDoc
      const result = detector.detectWithFallback(projectRoot, config);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                detected: true,
                source: "filesystem",
                stack: result,
                suggestion: "Add this to your .mags.yaml under the 'stack' key to persist the detection.",
                yamlSnippet: formatYamlSnippet(result),
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

function formatYamlSnippet(stack: {
  languages: string[];
  frameworks: string[];
  databases: string[];
  apiStyle: string[];
  packageManager: string;
}): string {
  const lines = ["stack:"];
  if (stack.languages.length > 0) {
    lines.push(`  primaryLanguage: "${stack.languages[0]}"`);
    lines.push(`  languages: [${stack.languages.map((l) => `"${l}"`).join(", ")}]`);
  }
  if (stack.frameworks.length > 0) {
    lines.push(`  frameworks: [${stack.frameworks.map((f) => `"${f}"`).join(", ")}]`);
  }
  if (stack.databases.length > 0) {
    lines.push(`  databases: [${stack.databases.map((d) => `"${d}"`).join(", ")}]`);
  }
  if (stack.apiStyle.length > 0) {
    lines.push(`  apiStyle: [${stack.apiStyle.map((a) => `"${a}"`).join(", ")}]`);
  }
  if (stack.packageManager) {
    lines.push(`  packageManager: "${stack.packageManager}"`);
  }
  return lines.join("\n");
}
