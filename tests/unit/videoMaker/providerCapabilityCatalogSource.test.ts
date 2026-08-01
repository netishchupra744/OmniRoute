import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fileUrl = new URL("../../../src/lib/videoMaker/providerCapabilityCatalog.ts", import.meta.url);

test("catalog keeps local providers disabled and unknown 1080p/Bangla/lip-sync conservative", async () => {
  const source = await readFile(fileUrl, "utf8");
  assert.match(source, /LOCAL_PROVIDER_IDS = new Set\(\["comfyui", "sdwebui"\]\)/);
  assert.match(source, /supportsBanglaVoice: false/);
  assert.match(source, /supportsLipSync: false/);
  assert.match(source, /supports1080p: false/);
  assert.match(source, /supportsFinalRendering: false/);
});
