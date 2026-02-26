import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "fs";

export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "react/index": "src/react/index.ts",
    "ui/index": "src/ui/index.ts",
    "mcp/index": "src/mcp/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  splitting: true,
  onSuccess: async () => {
    mkdirSync("dist/themes", { recursive: true });

    // Copy CSS files
    copyFileSync("src/ui/styles/base.css", "dist/styles.css");

    // Copy theme files
    copyFileSync("src/ui/styles/themes/vercel.css", "dist/themes/vercel.css");
    copyFileSync("src/ui/styles/themes/posthog.css", "dist/themes/posthog.css");
    copyFileSync("src/ui/styles/themes/linear.css", "dist/themes/linear.css");
    copyFileSync("src/ui/styles/themes/claude.css", "dist/themes/claude.css");
    copyFileSync(
      "src/ui/styles/themes/supabase.css",
      "dist/themes/supabase.css",
    );
    copyFileSync("src/ui/styles/themes/twitter.css", "dist/themes/twitter.css");
    copyFileSync(
      "src/ui/styles/themes/catppuccin.css",
      "dist/themes/catppuccin.css",
    );
    copyFileSync(
      "src/ui/styles/themes/modern-minimal.css",
      "dist/themes/modern-minimal.css",
    );

    console.log("✓ CSS files copied");
  },
});
