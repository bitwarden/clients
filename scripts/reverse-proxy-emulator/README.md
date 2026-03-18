# Reverse Proxy Emulator

A local development tool that emulates AWS ELB authentication without real AWS infrastructure. It sits in front of a Bitwarden server, gates all traffic behind a `BitwardenLoadBalancerCookie`, and serves a simple auth page to issue that cookie.

## How it works

- **Bypass paths** (`/api/config`, `/api/cookie-vendor`) are forwarded to the backend unconditionally, because the client needs them before it can authenticate.
- All other requests are checked for the `BitwardenLoadBalancerCookie`. Requests that carry the cookie are proxied to the backend.
- Requests without the cookie are redirected to `/_elb-auth`, which serves a page with a "Continue" button. Clicking the button sets the cookie in the browser and redirects back to the original URL.

WebSocket connections (used by the SignalR notification hub) are also gated on the cookie and proxied through.

## Quick start

```bash
npm run dev:reverse-proxy
```

Then configure your Bitwarden client (desktop, browser extension, or web vault) to use `https://localhost:8000` as its server URL.

## TLS certificates

The proxy serves HTTPS using the same TLS certificate as the web vault dev server (`apps/web/dev-server.shared.pem`). If you have a `dev-server.local.pem` in that directory, it takes precedence (same logic as the web vault's webpack config).

For the proxy to work, the certificate must be trusted by your OS or browser. If you have already trusted the certificate for the web vault dev server, no additional setup is needed.

On macOS, open **Keychain Access**, find the `localhost` certificate, double-click it, expand **Trust**, and set **When using this certificate** to **Always Trust**.

The same certificate is also used to verify the backend connection. Public backends (e.g. `vault.bitwarden.com`) are verified against the system CA bundle as normal. If the backend uses a different self-signed certificate that is not in your trust store, pass `--insecure` to skip TLS verification for the backend connection, this is not tested so it might not work in all cases.

## Configuration

All options can be set via environment variable or CLI argument. CLI arguments take precedence.

| CLI argument       | Environment variable | Default                       |
| ------------------ | -------------------- | ----------------------------- |
| `--port`           | `RPE_PORT`           | `8000`                        |
| `--backend`        | `RPE_BACKEND_URL`    | `https://localhost:8080`      |
| `--cookie-name`    | `RPE_COOKIE_NAME`    | `BitwardenLoadBalancerCookie` |
| `--cookie-max-age` | `RPE_COOKIE_MAX_AGE` | `86400` (24 h, in seconds)    |
| `--insecure`       | _(flag only)_        | `false`                       |

## Examples

Point at a remote backend:

```bash
npm run dev:reverse-proxy -- --backend https://vault.bitwarden.com
```

Use a different port and cookie TTL:

```bash
RPE_PORT=9000 RPE_COOKIE_MAX_AGE=3600 npm run dev:reverse-proxy
```

## Cookie rotation

Press **R** while the proxy is running to rotate the cookie and force all clients to re-authenticate on their next request. This is useful for testing the re-authentication flow without waiting for the cookie TTL to expire.

## Client configuration

Set the custom server URL in the Bitwarden client to `https://localhost:8000` (or whatever port you configured). The client will communicate through the proxy just as it would with a real load-balanced environment.

## Notes

- **Port conflicts**: if port 8000 is already in use, change it with `--port` or `RPE_PORT`.
- **Node version**: requires Node 22.12+ (the `--experimental-strip-types` flag used to run the script is stable from 22.12 onward).
