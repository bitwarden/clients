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

The proxy generates a self-signed TLS certificate on startup (takes ~2 seconds). Then configure your Bitwarden client (desktop, browser extension, or web vault) to use `https://localhost:8000` as its server URL.

**Browser**: visit `https://localhost:8000` first and accept the self-signed certificate warning before pointing the extension at it.

## Configuration

All options can be set via environment variable or CLI argument. CLI arguments take precedence.

| CLI argument       | Environment variable | Default                       |
| ------------------ | -------------------- | ----------------------------- |
| `--port`           | `RPE_PORT`           | `8000`                        |
| `--backend`        | `RPE_BACKEND_URL`    | `http://localhost:4000`       |
| `--cookie-name`    | `RPE_COOKIE_NAME`    | `BitwardenLoadBalancerCookie` |
| `--cookie-max-age` | `RPE_COOKIE_MAX_AGE` | `86400` (24 h, in seconds)    |
| `--insecure`       | _(flag only)_        | `false`                       |

## Examples

Point at a remote or staging backend:

```bash
npm run dev:reverse-proxy -- --backend https://staging.bitwarden.example.com --insecure
```

Use a different port and cookie TTL:

```bash
RPE_PORT=9000 RPE_COOKIE_MAX_AGE=3600 npm run dev:reverse-proxy
```

## Client configuration

Set the custom server URL in the Bitwarden client to `https://localhost:8000` (or whatever port you configured). The client will communicate through the proxy just as it would with a real load-balanced environment.

## Notes

- **Self-signed TLS on the backend**: pass `--insecure` to disable TLS certificate verification when the backend uses a self-signed certificate.
- **Port conflicts**: if port 8000 is already in use, change it with `--port` or `RPE_PORT`.
- **Node version**: requires Node 22.12+ (the `--experimental-strip-types` flag used to run the script is stable from 22.12 onward).
