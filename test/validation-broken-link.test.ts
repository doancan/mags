// ============================================
// MAGS — Validation Broken Link Integration Test
// existsSync fallback doğrulama
// ============================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DocIndexer } from "../server/src/services/doc-indexer.js";

function createTestDir(): string {
  const dir = join(tmpdir(), `mags-validation-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTestDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Validation logic'i simüle et (validation-tools.ts'den)
function checkBrokenLinks(
  docs: Array<{ name: string; path: string }>,
  docIndexer: DocIndexer
): Array<{ doc: string; linkedPath: string; isBroken: boolean }> {
  const results: Array<{ doc: string; linkedPath: string; isBroken: boolean }> = [];
  const docNames = new Set(docs.map((d) => d.name));

  for (const doc of docs) {
    const content = docIndexer.getDocContent(doc.name);
    if (!content) continue;

    const linkRegex = /\[.*?\]\(\.\/(.+?\.md)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(content)) !== null) {
      const linkedPath = match[1];
      const linkedFile = linkedPath.replace(".md", "").split("/").pop();

      // First check if document is indexed
      if (linkedFile && docNames.has(linkedFile)) {
        results.push({ doc: doc.name, linkedPath, isBroken: false });
        continue;
      }

      // Fallback: check if file exists on filesystem
      const fullPath = join(dirname(doc.path), linkedPath);
      const fileExists = existsSync(fullPath);
      results.push({ doc: doc.name, linkedPath, isBroken: !fileExists });
    }
  }

  return results;
}

describe("Validation: Broken Link with existsSync Fallback", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it("indekste olan dosyaya link → broken DEĞİL", () => {
    writeFileSync(join(testDir, "main.md"), `---
title: Main
status: draft
---
# Main

See [other](./other.md).
`);

    writeFileSync(join(testDir, "other.md"), `---
title: Other
status: draft
---
# Other
`);

    const indexer = new DocIndexer(testDir);
    const docs = indexer.index();
    const results = checkBrokenLinks(docs, indexer);

    expect(results.length).toBe(1);
    expect(results[0].isBroken).toBe(false);
    expect(results[0].linkedPath).toBe("other.md");
  });

  it("indekste YOK ama dosya VAR → broken DEĞİL (existsSync fallback)", () => {
    // Bu senaryo: glossary.md bir şekilde indekslenmemiş
    // ama dosya sisteminde var

    writeFileSync(join(testDir, "main.md"), `---
title: Main
status: draft
---
# Main

See [glossary](./reference/glossary.md).
`);

    // glossary.md'yi alt dizine koy
    mkdirSync(join(testDir, "reference"), { recursive: true });
    writeFileSync(join(testDir, "reference", "glossary.md"), `---
title: Glossary
status: draft
---
# Glossary

Terms here.
`);

    const indexer = new DocIndexer(testDir);
    const docs = indexer.index();

    // Kontrol: glossary indekslendi mi?
    const glossaryIndexed = docs.some(d => d.name === "glossary");

    // Eğer glossary indekslendiyse, normal şekilde çalışır
    // Eğer indekslenmediyse, existsSync fallback devreye girer
    const results = checkBrokenLinks(docs, indexer);

    // Link kontrolü yapılmalı
    const mainLinks = results.filter(r => r.doc === "main");
    expect(mainLinks.length).toBe(1);

    // Dosya var olduğu için broken olmamalı
    expect(mainLinks[0].isBroken).toBe(false);
  });

  it("indekste YOK ve dosya da YOK → broken", () => {
    writeFileSync(join(testDir, "main.md"), `---
title: Main
status: draft
---
# Main

See [nonexistent](./does-not-exist.md).
`);

    const indexer = new DocIndexer(testDir);
    const docs = indexer.index();
    const results = checkBrokenLinks(docs, indexer);

    expect(results.length).toBe(1);
    expect(results[0].isBroken).toBe(true);
    expect(results[0].linkedPath).toBe("does-not-exist.md");
  });

  it("relative path: ./subdir/file.md doğru çözülmeli", () => {
    // NOT: Mevcut regex sadece ./ ile başlayan linkleri yakalar
    // ../ linkleri şu an desteklenmiyor (gelecek geliştirme)
    mkdirSync(join(testDir, "subdir"), { recursive: true });

    writeFileSync(join(testDir, "main.md"), `---
title: Main
status: draft
---
# Main

See [info](./subdir/info.md).
`);

    writeFileSync(join(testDir, "subdir", "info.md"), `---
title: Info
status: draft
---
# Info
`);

    const indexer = new DocIndexer(testDir);
    const docs = indexer.index();
    const results = checkBrokenLinks(docs, indexer);

    const mainLinks = results.filter(r => r.doc === "main");
    expect(mainLinks.length).toBe(1);
    expect(mainLinks[0].isBroken).toBe(false);
  });

  it("çoklu linkler: bazıları broken, bazıları değil", () => {
    writeFileSync(join(testDir, "main.md"), `---
title: Main
status: draft
---
# Main

- [exists](./exists.md) - bu var
- [missing](./missing.md) - bu yok
- [also-exists](./also-exists.md) - bu da var
`);

    writeFileSync(join(testDir, "exists.md"), `---
title: Exists
status: draft
---
# Exists
`);

    writeFileSync(join(testDir, "also-exists.md"), `---
title: Also Exists
status: draft
---
# Also Exists
`);

    const indexer = new DocIndexer(testDir);
    const docs = indexer.index();
    const results = checkBrokenLinks(docs, indexer);

    const mainLinks = results.filter(r => r.doc === "main");
    expect(mainLinks.length).toBe(3);

    const brokenLinks = mainLinks.filter(r => r.isBroken);
    const validLinks = mainLinks.filter(r => !r.isBroken);

    expect(brokenLinks.length).toBe(1);
    expect(brokenLinks[0].linkedPath).toBe("missing.md");

    expect(validLinks.length).toBe(2);
  });
});
