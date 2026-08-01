#!/usr/bin/env node

import { createHash } from "node:crypto";
import { closeSync, copyFileSync, createReadStream, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const electronPackagePath = join(root, "electron", "package.json");
const electronPackage = JSON.parse(readFileSync(electronPackagePath, "utf8"));
const distDir = join(root, "electron", "dist-electron");
const releaseDir = join(root, "release-assets", "windows");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", rejectHash);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function verifyPeFile(path, minimumBytes) {
  assert(existsSync(path), `Missing Windows artifact: ${path}`);
  const stats = statSync(path);
  assert(stats.isFile(), `Expected a file: ${path}`);
  assert(stats.size >= minimumBytes, `${basename(path)} is unexpectedly small (${stats.size} bytes)`);
  const descriptor = openSync(path, "r");
  const headerBuffer = Buffer.alloc(2);
  try {
    readSync(descriptor, headerBuffer, 0, 2, 0);
  } finally {
    closeSync(descriptor);
  }
  assert(headerBuffer.toString("ascii") === "MZ", `${basename(path)} is not a valid PE/Windows executable`);
  return stats.size;
}

assert(electronPackage.build?.appId === "com.bijoy.aivideomaker", "Unexpected Electron appId");
assert(electronPackage.build?.productName === "Bijoy AI Video Maker", "Unexpected productName");
assert(
  electronPackage.build?.nsis?.artifactName === "Bijoy-AI-Video-Maker-Setup.exe",
  "Unexpected NSIS installer name"
);
assert(
  electronPackage.build?.portable?.artifactName === "Bijoy-AI-Video-Maker-Portable.exe",
  "Unexpected portable artifact name"
);
assert(electronPackage.build?.win?.executableName === "Bijoy AI Video Maker", "Unexpected executable name");

const setupPath = join(distDir, "Bijoy-AI-Video-Maker-Setup.exe");
const portablePath = join(distDir, "Bijoy-AI-Video-Maker-Portable.exe");
const unpackedPath = join(distDir, "win-unpacked", "Bijoy AI Video Maker.exe");

const artifacts = [
  { path: setupPath, kind: "installer", size: verifyPeFile(setupPath, 10 * 1024 * 1024) },
  { path: portablePath, kind: "portable", size: verifyPeFile(portablePath, 10 * 1024 * 1024) },
  { path: unpackedPath, kind: "unpacked-executable", size: verifyPeFile(unpackedPath, 10 * 1024 * 1024) },
];

await mkdir(releaseDir, { recursive: true });

const checksums = [];
for (const artifact of artifacts.slice(0, 2)) {
  const destination = join(releaseDir, basename(artifact.path));
  copyFileSync(artifact.path, destination);
  artifact.sha256 = await sha256(artifact.path);
  checksums.push(`${artifact.sha256}  ${basename(artifact.path)}`);
}

const latestYml = join(distDir, "latest.yml");
if (existsSync(latestYml)) {
  writeFileSync(join(releaseDir, "latest.yml"), readFileSync(latestYml));
}

writeFileSync(join(releaseDir, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`);
writeFileSync(
  join(releaseDir, "BUILD_MANIFEST.json"),
  `${JSON.stringify(
    {
      productName: electronPackage.build.productName,
      version: electronPackage.version,
      appId: electronPackage.build.appId,
      unsigned: !process.env.CSC_LINK,
      generatedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      artifacts: artifacts.map(({ path, ...artifact }) => ({
        ...artifact,
        file: basename(path),
      })),
    },
    null,
    2
  )}\n`
);

console.log("Bijoy AI Video Maker Windows release verification passed.");
console.log(`Release files: ${releaseDir}`);
