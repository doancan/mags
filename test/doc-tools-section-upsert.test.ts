import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════
// Doc Tools — Section Upsert Tests
// Validates that mags_update_doc creates missing
// sections instead of returning an error.
// ═══════════════════════════════════════════════════

// Mirrors the section-finding logic in doc-tools.ts
// but without gray-matter dependency — works on raw markdown.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface UpdateResult {
  content: string;
  created: boolean;
}

/**
 * Pure section update/upsert logic extracted from doc-tools.ts.
 * Operates on the markdown body (after frontmatter).
 */
function updateSectionInBody(body: string, section: string, newContent: string): UpdateResult {
  const sectionRegex = new RegExp(
    `(^#{1,3}\\s+${escapeRegex(section)}\\s*$)`,
    "m"
  );
  const match = sectionRegex.exec(body);

  if (!match) {
    // Upsert: append new section at end
    const trimmed = body.trimEnd();
    return {
      content: `${trimmed}\n\n## ${section}\n\n${newContent}\n`,
      created: true,
    };
  }

  const beforeSection = body.slice(0, match.index);
  const level = match[0].match(/^(#+)/)?.[1] ?? "##";

  const rest = body.slice(match.index + match[0].length);
  const nextHeading = rest.match(
    new RegExp(`^#{1,${level.length}}\\s+`, "m")
  );
  const afterSection = nextHeading
    ? rest.slice(rest.indexOf(nextHeading[0]))
    : "";

  return {
    content: `${beforeSection}${level} ${section}\n\n${newContent}\n\n${afterSection}`.trimEnd() + "\n",
    created: false,
  };
}

describe("section upsert behavior", () => {
  it("updates existing section", () => {
    const body = `
## Overview

Old overview content.

## Details

Some details here.
`;
    const result = updateSectionInBody(body, "Overview", "New overview content.");
    expect(result.created).toBe(false);
    expect(result.content).toContain("## Overview");
    expect(result.content).toContain("New overview content.");
    expect(result.content).not.toContain("Old overview content.");
    expect(result.content).toContain("## Details");
    expect(result.content).toContain("Some details here.");
  });

  it("creates new section when not found (upsert)", () => {
    const body = `
## Runtime

Node.js 20

## Database

PostgreSQL
`;
    const result = updateSectionInBody(body, "Summary", "This is a new summary section.");
    expect(result.created).toBe(true);
    expect(result.content).toContain("## Summary");
    expect(result.content).toContain("This is a new summary section.");
    expect(result.content).toContain("## Runtime");
    expect(result.content).toContain("Node.js 20");
    expect(result.content).toContain("## Database");
    expect(result.content).toContain("PostgreSQL");
  });

  it("appends new section at the end of document", () => {
    const body = `
## First

Content 1

## Second

Content 2
`;
    const result = updateSectionInBody(body, "Third", "Content 3");
    expect(result.created).toBe(true);

    const firstIdx = result.content.indexOf("## First");
    const secondIdx = result.content.indexOf("## Second");
    const thirdIdx = result.content.indexOf("## Third");
    expect(thirdIdx).toBeGreaterThan(secondIdx);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it("handles h3 sections correctly", () => {
    const body = `
## Parent

### Child A

Child A content.

### Child B

Child B content.
`;
    const result = updateSectionInBody(body, "Child A", "Updated child A.");
    expect(result.created).toBe(false);
    expect(result.content).toContain("### Child A");
    expect(result.content).toContain("Updated child A.");
    expect(result.content).toContain("### Child B");
    expect(result.content).toContain("Child B content.");
  });

  it("handles document with no sections", () => {
    const body = `
Just some text without any headings.
`;
    const result = updateSectionInBody(body, "Summary", "A summary.");
    expect(result.created).toBe(true);
    expect(result.content).toContain("Just some text without any headings.");
    expect(result.content).toContain("## Summary");
    expect(result.content).toContain("A summary.");
  });

  it("handles section names with special regex characters", () => {
    const body = `
## C++ & Rust

Content.
`;
    const result = updateSectionInBody(body, "C++ & Rust", "Updated.");
    expect(result.created).toBe(false);
    expect(result.content).toContain("Updated.");
  });

  it("does not match partial section names", () => {
    const body = `
## Summary Extended

Old content.
`;
    // "Summary" should NOT match "Summary Extended"
    const result = updateSectionInBody(body, "Summary", "New summary.");
    expect(result.created).toBe(true);
    expect(result.content).toContain("## Summary Extended");
    expect(result.content).toContain("Old content.");
  });

  it("replaces last section correctly (no next heading)", () => {
    const body = `
## First

Content 1.

## Last

Old last content.
`;
    const result = updateSectionInBody(body, "Last", "New last content.");
    expect(result.created).toBe(false);
    expect(result.content).toContain("New last content.");
    expect(result.content).not.toContain("Old last content.");
    expect(result.content).toContain("## First");
  });

  it("preserves empty body when upserting", () => {
    const result = updateSectionInBody("", "NewSection", "Content.");
    expect(result.created).toBe(true);
    expect(result.content).toContain("## NewSection");
    expect(result.content).toContain("Content.");
  });
});
