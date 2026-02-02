// ============================================
// MAGS — Stack Tools
// MCP tool handlers for stack detection
// ============================================

import { z } from "zod";
import { StackDetector } from "../services/stack-detector.js";

export function registerStackTools(server: any, projectRoot: string) {
  const detector = new StackDetector();

  // --- mags_detect_stack ---
  server.tool(
    "mags_detect_stack",
    "Detect the project's tech stack by scanning project files. Returns detected languages, frameworks, databases, API style, and package manager.",
    {},
    async () => {
      const result = detector.detect(projectRoot);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                detected: true,
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
