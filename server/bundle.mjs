import { build } from "esbuild";
import { builtinModules } from "module";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  minify: true,
  outfile: "dist/mags-server.bundle.mjs",
  external: builtinModules.flatMap((m) => [m, `node:${m}`]),
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log("Bundle created: dist/mags-server.bundle.mjs");
