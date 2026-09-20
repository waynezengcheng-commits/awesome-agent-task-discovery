import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const base = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const forbidden = /\b(?:github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|AIza[A-Za-z0-9_-]{35})\b|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----|\b(?:GITHUB_TOKEN|GH_TOKEN)\b|\/Users\/[^\/\s]+\/(?:Documents|Projects|\.codex)/;
const textExtensions = /\.(?:html|json|js|css|svg|txt|xml)$/;
async function walk(dir) {
  const paths = [];
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name);
    if (file.isDirectory()) paths.push(...(await walk(path))); else paths.push(path);
  }
  return paths;
}
const files = await walk(base);
for (const file of files) {
  assert.ok(!file.endsWith(".map"), `Source map should not be published: ${file}`);
  assert.ok(!/\/(?:radar|receipts|\.openai|scripts|\.github)\//.test(file), `Private build surface: ${file}`);
  if (textExtensions.test(file)) assert.ok(!forbidden.test(await readFile(file, "utf8")), `Credential or private-path pattern detected in ${file}`);
}
const html = await readFile(join(base, "index.html"), "utf8");
assert.ok(html.indexOf("Content-Security-Policy") < html.indexOf("<script"), "CSP must precede executable scripts");
assert.equal(await readFile(join(base, "404.html"), "utf8"), html, "SPA fallback must match index");
for (const ref of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = ref[1];
  if (url.startsWith("http")) continue;
  assert.ok(url.startsWith("/awesome-agent-task-discovery/"), `Wrong Pages base: ${url}`);
  await readFile(join(base, url.slice("/awesome-agent-task-discovery/".length)));
}
console.log(`Build audit passed: ${files.length} static files with no credentials or legacy radar assets.`);
