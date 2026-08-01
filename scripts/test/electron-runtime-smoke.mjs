#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const debugPort = Number(process.env.BIJOY_SMOKE_DEBUG_PORT || 9222);
const debugBase = `http://127.0.0.1:${debugPort}`;
const outputDir = process.env.GITHUB_WORKSPACE || process.cwd();
const diagnosticsPath = join(outputDir, "electron-runtime-diagnostics.json");
const screenshotPath = join(outputDir, "electron-runtime-smoke.png");
const timeoutMs = Number(process.env.BIJOY_SMOKE_TIMEOUT_MS || 180000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTarget() {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${debugBase}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page");
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw new Error(
    `Electron DevTools target did not appear on ${debugBase}: ${lastError?.message || "timeout"}`
  );
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const events = [];
    let nextId = 1;

    socket.addEventListener("open", () => {
      resolve({
        events,
        async send(method, params = {}) {
          const id = nextId++;
          const result = new Promise((resolveMessage, rejectMessage) => {
            pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
          });
          socket.send(JSON.stringify({ id, method, params }));
          return result;
        },
        close() {
          socket.close();
        },
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const waiter = pending.get(message.id);
        if (!waiter) return;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
        return;
      }
      if (
        message.method === "Runtime.consoleAPICalled" ||
        message.method === "Runtime.exceptionThrown" ||
        message.method === "Log.entryAdded" ||
        message.method === "Page.loadEventFired"
      ) {
        events.push(message);
      }
    });

    socket.addEventListener("error", (event) => {
      reject(new Error(`DevTools WebSocket failed: ${event?.message || "unknown error"}`));
    });
  });
}

const target = await waitForTarget();
const cdp = await connectCdp(target.webSocketDebuggerUrl);

try {
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Log.enable");
  await sleep(15000);

  const evaluation = await cdp.send("Runtime.evaluate", {
    expression: `(() => ({
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      bodyText: (document.body?.innerText || '').trim(),
      bodyHtmlLength: document.body?.innerHTML?.length || 0,
      rootHtmlLength: document.documentElement?.outerHTML?.length || 0,
      scriptSources: Array.from(document.scripts).map((script) => script.src || '[inline]'),
      stylesheetLinks: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.href),
      nextError: document.querySelector('nextjs-portal')?.shadowRoot?.textContent || null,
      resourceFailures: performance.getEntriesByType('resource')
        .filter((entry) => entry.transferSize === 0 && entry.duration > 0)
        .map((entry) => entry.name)
        .slice(0, 50)
    }))()`,
    returnByValue: true,
    awaitPromise: true,
  });

  const state = evaluation?.result?.value || null;
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  if (screenshot?.data) {
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  }

  const diagnostics = {
    capturedAt: new Date().toISOString(),
    target: {
      id: target.id,
      title: target.title,
      url: target.url,
    },
    state,
    events: cdp.events,
  };
  writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2));
  console.log(JSON.stringify(diagnostics, null, 2));

  const textLength = state?.bodyText?.length || 0;
  const htmlLength = state?.bodyHtmlLength || 0;
  const validUrl = /^http:\/\/127\.0\.0\.1:\d+\//.test(state?.href || "");
  const hasVisibleUi = textLength >= 20 && htmlLength >= 500;

  if (!validUrl || state?.readyState !== "complete" || !hasVisibleUi || state?.nextError) {
    throw new Error(
      `Packaged renderer smoke test failed: url=${state?.href}, ready=${state?.readyState}, text=${textLength}, html=${htmlLength}, nextError=${Boolean(state?.nextError)}`
    );
  }

  console.log(`Packaged renderer smoke test passed: ${state.href} (${textLength} visible characters).`);
} finally {
  cdp.close();
}
