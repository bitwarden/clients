// Smoke test: drives server/index.js over stdio with the MCP SDK client against a fake in-process
// Bitwarden desktop socket, so no desktop app, browser or vault is involved.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failures = 0;
function check(label, ok) {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) {
    failures++;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const testKey = randomBytes(32).toString("base64url");
const socketPath = join(tmpdir(), `bw-agent-fill-smoke-${process.pid}.sock`);

// Fake desktop: same JSON-lines protocol as the real one.
const seen = [];
let closedWhilePending = false;
const fakeDesktop = createServer((socket) => {
  let buffer = "";
  let pending = false;
  socket.setEncoding("utf8");
  socket.on("error", () => {});
  socket.on("close", () => {
    if (pending) {
      closedWhilePending = true;
    }
  });
  socket.on("data", (chunk) => {
    buffer += chunk;
    const newline = buffer.indexOf("\n");
    if (newline < 0) {
      return;
    }
    const req = JSON.parse(buffer.slice(0, newline));
    seen.push(req);
    const reply = (body) => socket.write(JSON.stringify({ id: req.id, ...body }) + "\n");
    if (req.key !== testKey) {
      return reply({ ok: false, reason: "connection_key_invalid", message: "Key not recognised." });
    }
    if (req.url.includes("deny")) {
      return reply({
        ok: false,
        reason: "denied_wrong_account",
        message: "Denied: wrong account.",
      });
    }
    if (req.url.includes("weird")) {
      return reply({ ok: false, reason: "not_in_contract", message: "x" });
    }
    if (req.url.includes("hang")) {
      pending = true;
      return;
    }
    if (req.tool === "fill_card") {
      return reply({ ok: true, result: { status: "filled", item: "Visa", last_four: "4242" } });
    }
    return reply({
      ok: true,
      result: { status: "filled", item: "Delta", username: "jane@example.com" },
    });
  });
});
await new Promise((r) => fakeDesktop.listen(socketPath, r));

async function startConnector(env) {
  const base = { ...process.env };
  delete base.BW_CONNECTION_KEY;
  delete base.BW_AGENT_FILL_SOCKET;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL("./server/index.js", import.meta.url).pathname],
    env: { ...base, ...env },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (d) => (stderr += d));
  const client = new Client({ name: "bw-connector-smoke", version: "0.1.0" });
  await client.connect(transport);
  return { client, getStderr: () => stderr };
}

const login = (client, url) => client.callTool({ name: "fill_login", arguments: { url } });

console.log("== connector -> fake desktop ==");
{
  const { client, getStderr } = await startConnector({
    BW_CONNECTION_KEY: testKey,
    BW_AGENT_FILL_SOCKET: socketPath,
  });
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  check("exposes only fill_card and fill_login", tools.join() === "fill_card,fill_login");

  const url = "https://www.delta.com/login";
  const ok = await login(client, url);
  check(
    "fill_login returns the desktop result",
    !ok.isError &&
      ok.structuredContent?.item === "Delta" &&
      JSON.parse(ok.content[0].text).username === "jane@example.com",
  );
  const sent = seen.at(-1);
  check(
    "request has exactly id, type, key, tool, url",
    Object.keys(sent).sort().join() === "id,key,tool,type,url" &&
      sent.type === "fill" &&
      sent.key === testKey &&
      sent.tool === "fill_login" &&
      sent.url === url,
  );

  const card = await client.callTool({
    name: "fill_card",
    arguments: { url: "https://shop.example.com/checkout" },
  });
  check(
    "fill_card returns last four",
    !card.isError &&
      card.structuredContent?.last_four === "4242" &&
      seen.at(-1).tool === "fill_card",
  );

  const denied = await login(client, "https://deny.example.com/");
  check(
    "failure passes reason and message through as a tool error",
    denied.isError === true &&
      denied.structuredContent?.reason === "denied_wrong_account" &&
      denied.structuredContent?.message === "Denied: wrong account.",
  );

  const weird = await login(client, "https://weird.example.com/");
  check("unknown reason becomes error", weird.structuredContent?.reason === "error");

  try {
    await client.callTool(
      { name: "fill_login", arguments: { url: "https://hang.example.com/" } },
      undefined,
      { timeout: 800 },
    );
    check("hung call times out on the client", false);
  } catch {
    await sleep(300);
    check("cancelling closes the desktop socket", closedWhilePending);
  }

  await client.close();
  await sleep(200);
  check(
    "key and URLs are absent from logs",
    !getStderr().includes(testKey) && !getStderr().includes("delta.com"),
  );
}

console.log("\n== wrong key (desktop is the authority) ==");
{
  const { client } = await startConnector({
    BW_CONNECTION_KEY: randomBytes(32).toString("base64url"),
    BW_AGENT_FILL_SOCKET: socketPath,
  });
  const r = await login(client, "https://www.delta.com/login");
  check(
    "desktop rejection -> connection_key_invalid",
    r.structuredContent?.reason === "connection_key_invalid",
  );
  await client.close();
}

console.log("\n== key missing, empty or unsubstituted ==");
for (const key of [undefined, "", "${user_config.connection_key}"]) {
  const env = { BW_AGENT_FILL_SOCKET: socketPath };
  if (key !== undefined) {
    env.BW_CONNECTION_KEY = key;
  }
  const before = seen.length;
  const { client } = await startConnector(env);
  const r = await login(client, "https://www.delta.com/login");
  check(
    `key ${JSON.stringify(key)} -> connection_key_invalid without contacting desktop`,
    r.isError === true &&
      r.structuredContent?.reason === "connection_key_invalid" &&
      r.structuredContent?.message.includes("Settings > Agent connections") &&
      seen.length === before,
  );
  await client.close();
}

console.log("\n== desktop not running ==");
{
  const { client } = await startConnector({
    BW_CONNECTION_KEY: testKey,
    BW_AGENT_FILL_SOCKET: join(tmpdir(), "bw-no-such.sock"),
  });
  const r = await login(client, "https://www.delta.com/login");
  check(
    "no socket -> desktop_unreachable",
    r.isError === true && r.structuredContent?.reason === "desktop_unreachable",
  );
  await client.close();
}

fakeDesktop.close();
rmSync(socketPath, { force: true });
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exitCode = failures ? 1 : 0;
