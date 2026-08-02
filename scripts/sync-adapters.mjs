import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const canonical = resolve(root, "skills", "project-to-act-collaboration");
const adapter = resolve(root, "plugins", "project-to-act-collaboration", "skills", "project-to-act-collaboration");
const files = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/adapters.md",
  "references/monitoring.md",
  "references/protocol.md",
  "scripts/pta.mjs",
];
const check = process.argv.includes("--check");
const changed = [];

for (const file of files) {
  const source = resolve(canonical, file);
  const target = resolve(adapter, file);
  if (!existsSync(target) || readFileSync(source).compare(readFileSync(target)) !== 0) {
    changed.push(file);
    if (!check) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
  }
}

if (check && changed.length) {
  console.error(`Adapter drift: ${changed.join(", ")}`);
  process.exitCode = 1;
} else console.log(JSON.stringify({ valid: true, mode: check ? "check" : "sync", changed }, null, 2));
