// The built gallery (site/dist) on 127.0.0.1, for the screen reader run. Static files only.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../site/dist", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** @param {import("node:http").IncomingMessage} request @param {import("node:http").ServerResponse} response */
async function serve(request, response) {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const file = normalize(join(root, path.endsWith("/") ? `${path}index.html` : path));
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try {
    const body = await readFile(file);
    response
      .writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
      .end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
}

createServer((request, response) => void serve(request, response)).listen(
  Number(process.argv[2] ?? 4174),
  "127.0.0.1",
);
