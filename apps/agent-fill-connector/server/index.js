#!/usr/bin/env node
// Bitwarden agent-fill connector (demo/prototype, not a released Bitwarden product).
// Forwards fill_login and fill_card to the Bitwarden desktop app over a local socket and returns
// the desktop app's answer. No credential ever passes through this process. The only secret it
// handles is the connection key, which is never logged or returned.
// Protocol: tech-breakdowns/ai-enablement/AI-137-agentic-autofill-desktop-approval/agent-fill-contract.md

import { randomUUID } from "node:crypto";
import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MAX_MESSAGE_BYTES = 64 * 1024;
// The desktop app expires an approval after 5 minutes. Wait a bit longer so its `expired`
// answer arrives before this timeout does.
const DESKTOP_TIMEOUT_MS = 310_000;

const REASONS = new Set([
  "denied",
  "denied_wrong_account",
  "denied_not_requested",
  "expired",
  "no_open_tab",
  "no_matching_item",
  "wrong_site",
  "form_not_found",
  "connection_paused",
  "locked",
  "connection_key_invalid",
  "desktop_unreachable",
  "browser_unreachable",
  "no_allowed_browser",
  "busy",
  "error",
]);

const MESSAGES = {
  connection_key_invalid:
    "The Bitwarden connection key is missing or invalid. Ask the user to paste the key from Bitwarden desktop Settings > Agent connections into this connector's settings in Claude Desktop.",
  desktop_unreachable:
    "The Bitwarden desktop app is not running or not listening for agent requests. Ask the user to open Bitwarden on this computer and try again.",
  error: "Bitwarden could not complete the request because of an unexpected error.",
};

const SOCKET_PATH =
  process.env.BW_AGENT_FILL_SOCKET || join(homedir(), ".bitwarden-agent-fill.sock");
const CONNECTION_KEY = (process.env.BW_CONNECTION_KEY ?? "").trim();

// Logging: JSON lines on stderr only (stdout is the MCP transport). Never pass a URL, the key,
// or anything from the desktop app's answer except the fixed reason.
function log(event, data = {}) {
  process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + "\n");
}

function keyUsable() {
  // Unset, empty, or an unsubstituted "${user_config...}" literal all count as missing. The
  // desktop app is the authority on whether the key is actually valid.
  return CONNECTION_KEY.length > 0 && !CONNECTION_KEY.includes("${user_config");
}

class DesktopUnreachable extends Error {}

// One connection per call, one JSON line each way. Destroying the socket (on abort, timeout or
// completion) tells the desktop app to drop a pending approval.
function desktopRequest(payload, { signal, timeoutMs = DESKTOP_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const socket = connect(SOCKET_PATH);
    let buffer = "";
    let settled = false;

    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      socket.destroy();
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error("timeout")), timeoutMs);
    const onAbort = () => finish(reject, new Error("cancelled"));
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(JSON.stringify(payload) + "\n"));
    socket.on("data", (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline < 0) {
        if (Buffer.byteLength(buffer) > MAX_MESSAGE_BYTES) {
          finish(reject, new Error("answer too large"));
        }
        return;
      }
      try {
        finish(resolve, JSON.parse(buffer.slice(0, newline)));
      } catch {
        finish(reject, new Error("bad answer"));
      }
    });
    socket.on("error", (e) =>
      finish(
        reject,
        e.code === "ENOENT" || e.code === "ECONNREFUSED" ? new DesktopUnreachable() : e,
      ),
    );
    socket.on("close", () => finish(reject, new Error("connection closed")));
  });
}

function failure(reason, message) {
  const body = { status: "failed", reason, message: message ?? MESSAGES[reason] ?? MESSAGES.error };
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
    structuredContent: body,
    isError: true,
  };
}

function success(result) {
  return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
}

async function forwardFill(tool, url, signal) {
  if (!keyUsable()) {
    log("tool_rejected", { tool, reason: "connection_key_invalid" });
    return failure("connection_key_invalid");
  }

  const started = Date.now();
  log("tool_start", { tool });
  try {
    const request = { id: randomUUID(), type: "fill", key: CONNECTION_KEY, tool, url };
    if (Buffer.byteLength(JSON.stringify(request)) + 1 > MAX_MESSAGE_BYTES) {
      return failure("error");
    }
    const answer = await desktopRequest(request, { signal });
    if (answer?.ok === true && answer.result && typeof answer.result === "object") {
      log("tool_end", { tool, outcome: "filled", ms: Date.now() - started });
      return success(answer.result);
    }
    const reason = REASONS.has(answer?.reason) ? answer.reason : "error";
    const message = typeof answer?.message === "string" ? answer.message : undefined;
    log("tool_end", { tool, outcome: "failed", reason, ms: Date.now() - started });
    return failure(reason, reason === "error" ? undefined : message);
  } catch (e) {
    const reason = e instanceof DesktopUnreachable ? "desktop_unreachable" : "error";
    log("tool_end", {
      tool,
      outcome: "failed",
      reason,
      cause: e.message,
      ms: Date.now() - started,
    });
    return failure(reason);
  }
}

const server = new McpServer(
  { name: "bitwarden-agent-connector", version: "0.1.0", title: "Bitwarden" },
  {
    instructions:
      "Demo connector. Use fill_login or fill_card when a login or checkout form on the page open in the browser needs the user's Bitwarden login or payment card. The user approves each fill in the Bitwarden desktop app. These tools never return passwords or full card numbers.",
  },
);

server.registerTool(
  "fill_login",
  {
    title: "Fill login with Bitwarden",
    description:
      "Ask Bitwarden to fill the login form on the page currently open at this URL. The user approves the request in the Bitwarden desktop app, then the Bitwarden browser extension fills the username and password directly into the page. Never returns the password; returns only which item was used and its username.",
    inputSchema: {
      url: z
        .string()
        .describe("Full URL of the page with the login form, e.g. https://www.delta.com/login"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ url }, extra) => forwardFill("fill_login", url, extra?.signal),
);

server.registerTool(
  "fill_card",
  {
    title: "Fill payment card with Bitwarden",
    description:
      "Ask Bitwarden to fill the payment card fields on the checkout page currently open at this URL. The user approves the request in the Bitwarden desktop app, then the Bitwarden browser extension fills the card directly into the page. Never returns the full card number or security code; returns only the card name and last four digits.",
    inputSchema: {
      url: z
        .string()
        .describe("Full URL of the checkout page, e.g. https://shop.example.com/checkout"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ url }, extra) => forwardFill("fill_card", url, extra?.signal),
);

await server.connect(new StdioServerTransport());
log("server_start", { version: "0.1.0" });
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => process.exit(0));
}
