import { copyFile, readFile, writeFile } from "node:fs/promises";
const index = new URL("../dist/index.html", import.meta.url);
let html = await readFile(index, "utf8");
const policy =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action https://github.com; object-src 'none'";
html = html.replace(
  /(<meta\s+charset=[^>]+>)/,
  `$1\n<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
);
await writeFile(index, html);
await copyFile(index, new URL("../dist/404.html", import.meta.url));
await writeFile(new URL("../dist/.nojekyll", import.meta.url), "");
console.log("Generated SPA 404 fallback and production CSP.");
