/* eslint-disable no-console */

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";

import { Router } from "@koa/router";
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

function describeProxyError(err: NodeJS.ErrnoException, backendUrl: string): string {
  switch (err.code) {
    case "ECONNREFUSED":
      return `Could not connect to backend at ${backendUrl}. Check that the server is running.`;
    case "ENOTFOUND":
      return `Could not resolve hostname for ${backendUrl}. Check the --backend URL.`;
    case "ETIMEDOUT":
    case "ESOCKETTIMEDOUT":
      return `Connection to backend at ${backendUrl} timed out.`;
    case "ECONNRESET":
      return `Connection to backend at ${backendUrl} was reset.`;
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY":
    case "CERT_HAS_EXPIRED":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return `TLS error connecting to ${backendUrl}: ${err.message}. Try the --insecure flag. Have you added the TLS cert to your trust store?`;
    default:
      return `Error proxying to ${backendUrl}: ${err.message}`;
  }
}

// ---------------------------------------------------------------------------
// Auth page
// ---------------------------------------------------------------------------

function authPageHtml(
  returnTo: string,
  cookieName: string,
  cookieValue: string,
  cookieMaxAge: number,
): string {
  // Use JSON.stringify for safe embedding of values into the inline script.
  const encodedReturnTo = JSON.stringify(encodeURIComponent(returnTo));
  const safeCookieName = JSON.stringify(cookieName);
  const safeCookieValue = JSON.stringify(cookieValue);

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
      document.cookie = ${safeCookieName} + "=" + ${safeCookieValue} + "; path=/; max-age=${cookieMaxAge}; SameSite=Lax; Secure";
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

let cookieGeneration = 0;

// Extend (not replace) the default CA bundle with our self-signed cert so that both
// localhost dev servers and public backends (e.g. vault.bitwarden.com) are trusted.
// --insecure skips verification entirely for backends with unknown certs.
const backendAgent = config.backendUrl.startsWith("https://")
  ? new https.Agent(
      config.insecure
        ? { rejectUnauthorized: false }
        : { ca: [...tls.rootCertificates, pem.toString()] },
    )
  : undefined;

const app = new Koa();
const router = new Router();

function proxyRequest(ctx: Koa.Context): void {
  ctx.respond = false;
  const target = new URL(ctx.originalUrl, config.backendUrl);
  const requestModule = target.protocol === "https:" ? https : http;
  const proxyReq = requestModule.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: target.pathname + target.search,
      method: ctx.method,
      headers: { ...ctx.req.headers, host: target.host },
      agent: backendAgent,
    },
    (proxyRes) => {
      ctx.res.writeHead(proxyRes.statusCode!, proxyRes.headers as http.OutgoingHttpHeaders);
      proxyRes.pipe(ctx.res);
    },
  );
  proxyReq.on("error", (err) => {
    const msg = describeProxyError(err, config.backendUrl);
    console.error(`[proxy] ${msg}`);
    if (!ctx.res.writableEnded) {
      ctx.res.writeHead(502, { "content-type": "text/plain" });
      ctx.res.end(msg);
    }
  });
  ctx.req.pipe(proxyReq);
}

// Auth page route — no cookie required.
router.get("/_elb-auth", (ctx) => {
  const rawReturnTo = ctx.query["return_to"];
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : (rawReturnTo ?? "/");
  ctx.type = "text/html";
  ctx.body = authPageHtml(
    returnTo,
    config.cookieName,
    String(cookieGeneration),
    config.cookieMaxAge,
  );
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
  if (cookies[config.cookieName] === String(cookieGeneration)) {
    proxyRequest(ctx);
    return;
  }

  ctx.redirect(`/_elb-auth?return_to=${encodeURIComponent(ctx.originalUrl)}`);
});

const server = https.createServer({ key: pem, cert: pem }, app.callback());

server.on("upgrade", (req, clientSocket, head) => {
  const cookies = parseCookies(req.headers["cookie"]);
  if (!isBypassPath(req.url ?? "") && !cookies[config.cookieName]) {
    clientSocket.destroy();
    return;
  }

  const target = new URL(config.backendUrl);
  const isHttps = target.protocol === "https:";
  const port = parseInt(target.port) || (isHttps ? 443 : 80);
  const tlsOptions = config.insecure
    ? { rejectUnauthorized: false }
    : { ca: [...tls.rootCertificates, pem.toString()] };

  const serverSocket: net.Socket = isHttps
    ? tls.connect({ host: target.hostname, port, servername: target.hostname, ...tlsOptions })
    : net.connect({ host: target.hostname, port });

  serverSocket.on("connect", () => {
    const headerLines = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\r\n");
    serverSocket.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
    if (head?.length) {
      serverSocket.write(head);
    }
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on("error", (err) => {
    console.error(`[ws proxy] ${describeProxyError(err, config.backendUrl)}`);
    clientSocket.destroy();
  });
  clientSocket.on("error", () => serverSocket.destroy());
});

server.listen(config.port, () => {
  console.log("Reverse Proxy Emulator started");
  console.log(`  Listening:    https://localhost:${config.port}`);
  console.log(`  Backend:      ${config.backendUrl}`);
  console.log(`  Cookie name:  ${config.cookieName}`);
  console.log(`  Cookie TTL:   ${config.cookieMaxAge}s`);
  console.log(`  Insecure TLS: ${config.insecure}`);
  console.log(`  Bypass paths: ${BYPASS_PATHS.join(", ")}`);
  console.log(`  Press R to rotate the cookie and force re-authentication.`);
});

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (key: string) => {
    if (key === "\u0003") {
      process.exit();
    } // Ctrl+C
    if (key === "r" || key === "R") {
      cookieGeneration++;
      console.log(
        `Cookie rotated to generation ${cookieGeneration} — clients will re-authenticate on next request.`,
      );
    }
  });
}
