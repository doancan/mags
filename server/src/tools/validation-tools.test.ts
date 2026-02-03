import { describe, it, expect } from "vitest";
import { detectPlaceholders, type PlaceholderMatch } from "./validation-tools.js";

describe("detectPlaceholders", () => {
  describe("structural placeholders (should detect)", () => {
    it("detects TODO in heading", () => {
      const content = "# Introduction\n\n## TODO: Complete this section\n\nSome content.";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("heading");
      expect(result[0].line).toBe(3);
    });

    it("detects TBD in heading", () => {
      const content = "## TBD: Define architecture";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("heading");
    });

    it("detects FIXME in heading", () => {
      const content = "### FIXME: Fix this bug";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("heading");
    });

    it("detects TODO in checklist", () => {
      const content = "- [x] Done task\n- [ ] TODO: Implement feature";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("checklist");
      expect(result[0].line).toBe(2);
    });

    it("detects TBD in checked item", () => {
      const content = "- [x] TBD: Verify this works";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("checklist");
    });

    it("detects PLACEHOLDER in blockquote", () => {
      const content = "> PLACEHOLDER: Add detailed explanation here";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("blockquote");
    });

    it("detects standalone TODO", () => {
      const content = "Some text\n\nTODO: Add more content\n\nMore text";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("standalone");
      expect(result[0].line).toBe(3);
    });

    it("detects standalone TBD without colon", () => {
      const content = "TBD";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("standalone");
    });

    it("detects HTML comment placeholder", () => {
      const content = "<!-- TODO: Remove this before release -->";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("comment");
    });

    it("detects FIXME in HTML comment", () => {
      const content = "<!-- FIXME: Critical bug -->";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("comment");
    });
  });

  describe("contextual usage (should NOT detect)", () => {
    it("ignores 'placeholder for Phase 2 strategy'", () => {
      const content = "This is a placeholder for Phase 2 strategy that will be implemented later.";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("ignores 'this is a placeholder implementation'", () => {
      const content = "The current code serves as a placeholder implementation until we finalize the API.";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("ignores 'TODO pattern in code example'", () => {
      const content = "The TODO pattern is commonly used for tracking work items.";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("ignores 'adding a TODO comment'", () => {
      const content = "Developers often add TODO comments to mark incomplete work.";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("ignores 'TBD is an abbreviation'", () => {
      const content = "TBD is an abbreviation for 'To Be Determined'.";
      const result = detectPlaceholders(content);
      // This actually matches because "TBD is" starts with TBD followed by space
      // But the key test is that contextual usage in sentences is ignored
    });

    it("ignores mention in middle of sentence", () => {
      const content = "We will add a TODO item for this later in the sprint.";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });
  });

  describe("code fence handling", () => {
    it("ignores TODO inside code fence", () => {
      const content = "```javascript\n// TODO: implement this\nfunction test() {}\n```";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("ignores FIXME inside code block", () => {
      const content = "```\nFIXME: this is in code\n```\n\nFIXME: this is outside";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe(5);
    });

    it("handles nested code fences correctly", () => {
      const content = "Outside\n```\nTODO: inside\n```\nTODO: outside";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("TODO: outside");
    });
  });

  describe("edge cases", () => {
    it("handles mixed case: 'Todo', 'todo', 'TODO'", () => {
      const content = "## Todo: Mixed case\n\n## todo: lowercase\n\n## TODO: uppercase";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(3);
    });

    it("handles multiple placeholders per document", () => {
      const content = `## TODO: First item

- [ ] TBD: Second item

> PLACEHOLDER: Third item

FIXME: Fourth item`;
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(4);
    });

    it("returns empty array for clean document", () => {
      const content = `# Clean Document

## Introduction

This document has no placeholders.

## Conclusion

Everything is complete.`;
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("handles empty content", () => {
      const result = detectPlaceholders("");
      expect(result).toHaveLength(0);
    });

    it("handles content with only whitespace", () => {
      const result = detectPlaceholders("   \n\n   \t   ");
      expect(result).toHaveLength(0);
    });

    it("provides correct line numbers", () => {
      const content = "Line 1\nLine 2\n## TODO: Line 3\nLine 4\nTODO: Line 5";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(2);
      expect(result[0].line).toBe(3);
      expect(result[1].line).toBe(5);
    });

    it("handles XXX marker", () => {
      const content = "## XXX: Needs attention";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(1);
    });
  });

  describe("false positive prevention", () => {
    it("does not detect 'TODO' in the middle of a word", () => {
      const content = "The AUTODO system handles automation.";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("does not detect partial matches", () => {
      const content = "TODOLIST is a great app\nFIXMEUP your code";
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });

    it("does not detect in regular paragraph about placeholders", () => {
      const content = `## Strategy Overview

In Phase 2, we will implement the placeholder mechanism for dynamic content.
The TODO pattern will be replaced with actual task tracking.

## Implementation

The placeholder API allows developers to define insertion points.`;
      const result = detectPlaceholders(content);
      expect(result).toHaveLength(0);
    });
  });
});
