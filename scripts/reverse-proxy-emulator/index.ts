/* eslint-disable no-console */

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

import { Router } from "@koa/router";
import httpProxy from "http-proxy";
import Koa from "koa";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface Config {
  port: number;
  backendUrl: string;
  cookieName: string;
  cookieMaxAge: number;
  insecure: boolean;
}

function parseCliArgs(): Partial<Config> {
  const args = process.argv.slice(2);
  const result: Partial<Config> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--port":
        result.port = parseInt(args[++i], 10);
        break;
      case "--backend":
        result.backendUrl = args[++i];
        break;
      case "--cookie-name":
        result.cookieName = args[++i];
        break;
      case "--cookie-max-age":
        result.cookieMaxAge = parseInt(args[++i], 10);
        break;
      case "--insecure":
        result.insecure = true;
        break;
    }
  }

  return result;
}

function buildConfig(): Config {
  const cli = parseCliArgs();
  return {
    port: cli.port ?? parseInt(process.env.RPE_PORT ?? "8000", 10),
    backendUrl: cli.backendUrl ?? process.env.RPE_BACKEND_URL ?? "https://localhost:8080",
    cookieName: cli.cookieName ?? process.env.RPE_COOKIE_NAME ?? "BitwardenLoadBalancerCookie",
    cookieMaxAge: cli.cookieMaxAge ?? parseInt(process.env.RPE_COOKIE_MAX_AGE ?? "86400", 10),
    insecure: cli.insecure ?? false,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }
  return Object.fromEntries(
    header
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const eq = s.indexOf("=");
        if (eq === -1) {
          return [s, ""];
        }
        return [s.slice(0, eq).trim(), decodeURIComponent(s.slice(eq + 1).trim())];
      }),
  );
}

const BYPASS_PATHS = ["/api/config", "/api/cookie-vendor"];

function isBypassPath(urlPath: string): boolean {
  return BYPASS_PATHS.some((bp) => urlPath === bp || urlPath.startsWith(bp + "/"));
}

// ---------------------------------------------------------------------------
// Auth page
// ---------------------------------------------------------------------------

function authPageHtml(returnTo: string, cookieName: string, cookieMaxAge: number): string {
  // Use JSON.stringify for safe embedding of values into the inline script.
  const encodedReturnTo = JSON.stringify(encodeURIComponent(returnTo));
  const safeCookieName = JSON.stringify(cookieName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authentication Required</title>
  <style>
    body {
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 400px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    button {
      background: #175DDC;
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover { background: #1249b3; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Required</h1>
    <p>This environment requires a load balancer session cookie to proceed.</p>
    <button onclick="authenticate()">Continue</button>
  </div>
  <script>
    function authenticate() {
      var returnTo = decodeURIComponent(${encodedReturnTo});
      document.cookie = ${safeCookieName} + "=authenticated; path=/; max-age=${cookieMaxAge}; SameSite=Lax; Secure";
      window.location.href = returnTo;
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// TLS — mirrors the certificate selection logic from apps/web/webpack.base.js.
// Prefers dev-server.local.pem (developer override) then dev-server.shared.pem
// (checked-in shared cert). Both files contain key + cert in a single PEM.
// ---------------------------------------------------------------------------

function loadTlsPem(): Buffer {
  const webDir = path.join(process.cwd(), "apps", "web");
  for (const name of ["dev-server.local.pem", "dev-server.shared.pem"]) {
    const p = path.join(webDir, name);
    if (fs.existsSync(p)) {
      console.log(`  Using TLS cert: apps/web/${name}`);
      return fs.readFileSync(p);
    }
  }
  throw new Error(
    "No TLS certificate found. Expected apps/web/dev-server.shared.pem or apps/web/dev-server.local.pem.",
  );
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const config = buildConfig();
const pem = loadTlsPem();

// Trust the same cert for backend connections (backend uses the same self-signed cert).
// --insecure skips verification entirely for backends with unknown certs.
const backendAgent = config.backendUrl.startsWith("https://")
  ? new https.Agent(config.insecure ? { rejectUnauthorized: false } : { ca: pem })
  : undefined;

const app = new Koa();
const router = new Router();
const proxy = httpProxy.createProxyServer({});

proxy.on("error", (err, _req, res) => {
  console.error("[proxy error]", err.message);
  // `res` can be http.ServerResponse (HTTP) or net.Socket (WebSocket upgrade).
  // Only attempt to write an HTTP response when the writable interface is present.
  const httpRes = res as http.ServerResponse;
  if (typeof httpRes.writeHead === "function" && !httpRes.writableEnded) {
    httpRes.writeHead(502);
    httpRes.end("Bad Gateway");
  }
});

const proxyOptions = {
  target: config.backendUrl,
  changeOrigin: true,
  xfwd: true,
  agent: backendAgent,
};

function proxyRequest(ctx: Koa.Context): void {
  ctx.respond = false;
  proxy.web(ctx.req, ctx.res, proxyOptions);
}

// Auth page route — no cookie required.
router.get("/_elb-auth", (ctx) => {
  const rawReturnTo = ctx.query["return_to"];
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : (rawReturnTo ?? "/");
  ctx.type = "text/html";
  ctx.body = authPageHtml(returnTo, config.cookieName, config.cookieMaxAge);
});

app.use(router.routes());
app.use(router.allowedMethods());

// Gate: bypass paths pass through; cookie present passes through; otherwise redirect.
app.use((ctx) => {
  if (isBypassPath(ctx.path)) {
    proxyRequest(ctx);
    return;
  }

  const cookies = parseCookies(ctx.request.headers["cookie"]);
  if (cookies[config.cookieName]) {
    proxyRequest(ctx);
    return;
  }

  ctx.redirect(`/_elb-auth?return_to=${encodeURIComponent(ctx.originalUrl)}`);
});

const server = https.createServer({ key: pem, cert: pem }, app.callback());

server.on("upgrade", (req, socket, head) => {
  const cookies = parseCookies(req.headers["cookie"]);
  if (!isBypassPath(req.url ?? "") && !cookies[config.cookieName]) {
    socket.destroy();
    return;
  }

  proxy.ws(req, socket, head, {
    target: config.backendUrl,
    changeOrigin: true,
    agent: backendAgent,
  });
});

server.listen(config.port, () => {
  console.log("Reverse Proxy Emulator started");
  console.log(`  Listening:    https://localhost:${config.port}`);
  console.log(`  Backend:      ${config.backendUrl}`);
  console.log(`  Cookie name:  ${config.cookieName}`);
  console.log(`  Cookie TTL:   ${config.cookieMaxAge}s`);
  console.log(`  Insecure TLS: ${config.insecure}`);
  console.log(`  Bypass paths: ${BYPASS_PATHS.join(", ")}`);
});
