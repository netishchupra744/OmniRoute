#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function collectTests(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      results.push(...collectTests(fullPath));
    } else if (entry.endsWith(".test.ts")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

const unitDir = join(root, "tests", "unit", "videoMaker");
const tests = [
  ...collectTests(unitDir),
  join(root, "tests", "integration", "videoMakerPersistence.test.ts"),
];

const args = [
  "--max-old-space-size=4096",
  "--import",
  "tsx/esm",
  "--import",
  "./open-sse/utils/setupPolyfill.ts",
  "--import",
  "./tests/_setup/isolateDataDir.ts",
  "--test",
  "--test-force-exit",
  "--test-concurrency=1",
  ...tests,
];

console.log(`Running ${tests.length} Bijoy AI Video Maker test files...`);
const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    DISABLE_SQLITE_AUTO_BACKUP: "true",
    NODE_ENV: "test",
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
