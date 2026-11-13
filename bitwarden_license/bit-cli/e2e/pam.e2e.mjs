#!/usr/bin/env node
// End-to-end test of the `bw privileged-controls` commands against a LOCAL Bitwarden server.
//
// It drives the built commercial CLI as separate users (owner, admin, member, reports-only member,
// and an owner of an org without Privileged Controls), creates its own uniquely named rule, and
// removes everything it created. It never prints or stores a secret: revealed fields are measured
// by length only. See README.md in this folder for setup and the exit codes.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;

const config = {
  cli: env.PAM_E2E_CLI ?? resolve(here, "../../../apps/cli/build/bw.js"),
  api: env.PAM_E2E_API ?? "http://localhost:4000",
  identity: env.PAM_E2E_IDENTITY ?? "http://localhost:33656",
  webVault: env.PAM_E2E_WEB_VAULT ?? "https://localhost:8080",
  password: env.PAM_E2E_PASSWORD,
  orgId: env.PAM_E2E_ORG_ID,
  otherOrgId: env.PAM_E2E_OTHER_ORG_ID,
  collectionName: env.PAM_E2E_COLLECTION ?? "Engineering/Cloud Infrastructure",
  reportDir: env.PAM_E2E_REPORT_DIR ?? join(tmpdir(), "pam-e2e-report"),
  personas: {
    owner: env.PAM_E2E_OWNER ?? "owner@bw.example",
    admin: env.PAM_E2E_ADMIN ?? "admin@bw.example",
    user: env.PAM_E2E_USER ?? "user@bw.example",
    custom: env.PAM_E2E_CUSTOM ?? "custom@bw.example",
    other: env.PAM_E2E_OTHER ?? "owner@other.example",
  },
};

for (const key of ["password", "orgId", "otherOrgId"]) {
  if (!config[key]) {
    console.error(
      `Set PAM_E2E_PASSWORD, PAM_E2E_ORG_ID and PAM_E2E_OTHER_ORG_ID (missing: ${key}). See README.md.`,
    );
    process.exit(2);
  }
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(config.api)) {
  console.error("Refusing to run: PAM_E2E_API must be a localhost server.");
  process.exit(2);
}

const runId = `e2e-${config.orgId.slice(0, 4)}-${process.pid}`;
const root = mkdtempSync(join(tmpdir(), "pam-e2e-"));
const sessions = {};

/** Runs the CLI as a persona. `redact` keeps only output sizes (for anything secret). */
function bw(persona, args, { stdin, redact = false, noSession = false } = {}) {
  const result = spawnSync("node", [config.cli, ...args], {
    input: stdin,
    encoding: "utf8",
    timeout: 90_000,
    env: {
      ...env,
      PAM_E2E_PASSWORD: config.password,
      BITWARDENCLI_APPDATA_DIR: join(root, persona),
      BW_NOINTERACTION: "true",
      NODE_NO_WARNINGS: "1",
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
      ...(noSession || !sessions[persona] ? {} : { BW_SESSION: sessions[persona] }),
    },
  });
  const out = (result.stdout ?? "").trim();
  const err = (result.stderr ?? "").trim();
  let json;
  for (const text of [out, out.split("\n").pop()]) {
    try {
      json = JSON.parse(text);
      break;
    } catch {
      // not JSON: plain text output
    }
  }
  const text = `${out}\n${err}`;
  const ok = result.status === 0 && json?.success !== false;
  if (redact) {
    return { ok, code: result.status, bytes: out.length, text: ok ? "" : err || out };
  }
  return { ok, code: result.status, out, err, json, text, data: json?.data };
}

const list = (r) => r.data?.data ?? (Array.isArray(r.json) ? r.json : []);

// ---- tiny test harness -------------------------------------------------------------------------

const results = [];
const state = {};

class Skip extends Error {}
const skip = (why) => {
  throw new Skip(why);
};
const need = (value, what) => value ?? skip(`needs ${what}`);
const assert = (cond, msg) => {
  if (!cond) {
    throw new Error(msg);
  }
};
const refused = (r, pattern, what) => {
  assert(!r.ok, `${what}: expected a refusal but the command succeeded`);
  assert(
    pattern.test(r.text),
    `${what}: refused with an unexpected message: ${r.text.slice(0, 200)}`,
  );
};
const succeeded = (r, what) => assert(r.ok, `${what} failed: ${r.text.slice(0, 300)}`);

async function test(id, name, fn) {
  const started = Date.now();
  let status = "pass";
  let detail = "";
  try {
    const note = await fn();
    detail = typeof note === "string" ? note : "";
  } catch (e) {
    status = e instanceof Skip ? "skip" : "fail";
    detail = e.message;
  }
  results.push({ id, name, status, detail, ms: Date.now() - started });
  const mark = { pass: "PASS", fail: "FAIL", skip: "SKIP" }[status];
  console.log(`${mark}  ${id}  ${name}${detail ? `\n        ${detail}` : ""}`);
}

/** An observation that must be reviewed by a person, not an assertion either way. */
function observe(id, name, detail) {
  results.push({ id, name, status: "observe", detail, ms: 0 });
  console.log(`NOTE  ${id}  ${name}\n        ${detail}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

async function submitRequest(reason, startInMs = 15_000) {
  state.windowStart = iso(startInMs);
  const r = bw(
    "user",
    [
      "privileged-controls",
      "request",
      "create",
      state.cipherId,
      "--start",
      state.windowStart,
      "--end",
      iso(3_600_000),
      "--reasonstdin",
      "--response",
    ],
    { stdin: reason },
  );
  succeeded(r, "request create");
  return r.data;
}

// ---- setup / teardown -------------------------------------------------------------------------

function setup() {
  for (const persona of Object.keys(config.personas)) {
    mkdirSync(join(root, persona), { recursive: true });
    const cfg = bw(
      persona,
      [
        "config",
        "server",
        "--api",
        config.api,
        "--identity",
        config.identity,
        "--web-vault",
        config.webVault,
      ],
      { noSession: true },
    );
    assert(cfg.code === 0, `config server failed for ${persona}: ${cfg.text.slice(0, 200)}`);
    const login = bw(
      persona,
      ["login", config.personas[persona], "--passwordenv", "PAM_E2E_PASSWORD", "--raw"],
      {
        noSession: true,
      },
    );
    assert(
      login.code === 0 && login.out,
      `login failed for ${persona}: ${login.text.slice(0, 200)}`,
    );
    sessions[persona] = login.out;
    assert(bw(persona, ["sync"]).code === 0, `sync failed for ${persona}`);
  }

  const collections = list({
    json: bw("owner", ["list", "org-collections", "--organizationid", config.orgId]).json,
  });
  const collection = collections.find((c) => c.name === config.collectionName);
  assert(collection, `collection "${config.collectionName}" not found in the org`);
  state.collectionId = collection.id;

  const rules = list(
    bw("owner", [
      "privileged-controls",
      "rule",
      "list",
      "--organizationid",
      config.orgId,
      "--response",
    ]),
  );
  const clash = rules.find((x) => x.collectionIds.includes(state.collectionId));
  assert(
    !clash,
    `collection already governed by rule "${clash?.name}"; pick another with PAM_E2E_COLLECTION`,
  );

  const items = bw("owner", ["list", "items", "--organizationid", config.orgId]).json ?? [];
  const item = items.find((i) => (i.collectionIds ?? []).includes(state.collectionId));
  assert(item, "no cipher in the target collection");
  state.cipherId = item.id;
  state.startedAt = new Date().toISOString();
}

function teardown() {
  const notes = [];
  const attempt = (label, r) => {
    if (!r.ok) {
      notes.push(`${label}: ${r.text.slice(0, 120)}`);
    }
  };
  for (const id of state.requests ?? []) {
    bw("user", ["privileged-controls", "request", "cancel", id]); // fails harmlessly when already decided
  }
  for (const id of state.leases ?? []) {
    bw("user", ["privileged-controls", "lease", "end", id, "--yes"]);
  }
  if (state.ruleId) {
    attempt(
      "delete rule",
      bw("admin", [
        "privileged-controls",
        "rule",
        "delete",
        state.ruleId,
        "--organizationid",
        config.orgId,
        "--yes",
        "--response",
      ]),
    );
  }
  for (const persona of Object.keys(config.personas)) {
    bw(persona, ["logout"]);
  }
  rmSync(root, { recursive: true, force: true });
  return notes;
}

// ---- the suite ----------------------------------------------------------------------------------

async function suite() {
  // A. Entitlements -------------------------------------------------------------------------------
  const statusOf = (persona, orgId = config.orgId) =>
    bw(persona, ["privileged-controls", "status", "--response"]).data?.organizations?.find(
      (o) => o.id === orgId,
    );

  await test(
    "A1",
    "status: owner and admin can manage rules and rotation, and read event logs",
    () => {
      for (const p of ["owner", "admin"]) {
        const s = statusOf(p);
        assert(s?.usePam && s.accessPam, `${p}: PAM not enabled`);
        assert(
          s.canManageAccessRules && s.canManageRotation && s.canAccessEventLogs,
          `${p}: missing admin capability`,
        );
      }
    },
  );
  await test("A2", "status: a member has access but no admin capabilities", () => {
    const s = statusOf("user");
    assert(s?.usePam && s.accessPam, "member: PAM not enabled");
    assert(
      !s.canManageAccessRules && !s.canManageRotation && !s.canAccessEventLogs,
      "member has an admin capability",
    );
  });
  await test("A3", "status: a reports-only custom member gets only canAccessReports", () => {
    const s = statusOf("custom");
    assert(
      s.canAccessReports && !s.canManageAccessRules && !s.canAccessEventLogs,
      JSON.stringify(s),
    );
  });
  await test("A4", "status: an org without Privileged Controls reports usePam false", () => {
    const s = statusOf("other", config.otherOrgId);
    assert(s && s.usePam === false && s.accessPam === false, JSON.stringify(s));
  });
  await test("A5", "request status in an org without PAM is refused with a clear message", () => {
    refused(
      bw("other", ["privileged-controls", "request", "status", state.cipherId, "--response"]),
      /do(es)? not use Privileged Controls|None of your organizations/i,
      "other-org status",
    );
  });
  await test(
    "A6",
    "rule list, get and bypassable in an org without Privileged Controls are refused clearly",
    () => {
      const anyId = "00000000-0000-4000-8000-000000000000";
      for (const verb of [["list"], ["get", anyId], ["bypassable", anyId]]) {
        refused(
          bw("other", [
            "privileged-controls",
            "rule",
            ...verb,
            "--organizationid",
            config.otherOrgId,
            "--response",
          ]),
          /does not use Privileged Controls/i,
          `other-org rule ${verb[0]}`,
        );
      }
      refused(
        bw("owner", [
          "privileged-controls",
          "rule",
          "list",
          "--organizationid",
          anyId,
          "--response",
        ]),
        /not found, or you are not a member/i,
        "unknown organization",
      );
    },
  );

  // B. Access rules (admin) -----------------------------------------------------------------------
  await test(
    "B1",
    "validate-cidr succeeds when all are valid; fails but reports every verdict when one is not",
    () => {
      succeeded(
        bw("owner", [
          "privileged-controls",
          "rule",
          "validate-cidr",
          "10.0.0.0/8",
          "192.168.1.0/24",
          "--response",
        ]),
        "all valid",
      );
      const mixed = bw("owner", [
        "privileged-controls",
        "rule",
        "validate-cidr",
        "10.0.0.0/8",
        "not-a-cidr",
        "--response",
      ]);
      assert(!mixed.ok, "an invalid CIDR should make the command fail");
      const verdicts = Object.fromEntries(list(mixed).map((c) => [c.cidr, c.valid]));
      assert(
        verdicts["10.0.0.0/8"] === true && verdicts["not-a-cidr"] === false,
        JSON.stringify(verdicts),
      );
    },
  );
  const ruleJson = JSON.stringify({
    name: `CLI ${runId} - human approval`,
    enabled: true,
    conditions: [{ kind: "human_approval" }],
    singleActiveLease: false,
    defaultLeaseDurationSeconds: 3600,
    maxLeaseDurationSeconds: 28800,
    allowsExtensions: true,
    maxExtensionDurationSeconds: 1800,
    collections: [state.collectionId],
  });
  await test("B2", "a member and a reports-only member cannot create rules", () => {
    for (const p of ["user", "custom"]) {
      refused(
        bw(p, [
          "privileged-controls",
          "rule",
          "create",
          ruleJson,
          "--organizationid",
          config.orgId,
          "--response",
        ]),
        /permission/i,
        `${p} create`,
      );
    }
  });
  await test("B3", "admin creates a human-approval rule on the target collection", () => {
    const r = bw(
      "admin",
      ["privileged-controls", "rule", "create", "--organizationid", config.orgId, "--response"],
      { stdin: ruleJson },
    );
    succeeded(r, "rule create");
    state.ruleId = r.data.id;
    assert(r.data.requiresHumanApproval === true, "rule should require human approval");
    assert(
      r.data.collectionIds.includes(state.collectionId),
      "rule does not govern the collection",
    );
  });
  await test("B4", "rule get and list return the new rule", () => {
    need(state.ruleId, "B3");
    const got = bw("admin", [
      "privileged-controls",
      "rule",
      "get",
      state.ruleId,
      "--organizationid",
      config.orgId,
      "--response",
    ]);
    succeeded(got, "rule get");
    assert(got.data.id === state.ruleId, "get returned a different rule");
    const all = list(
      bw("admin", [
        "privileged-controls",
        "rule",
        "list",
        "--organizationid",
        config.orgId,
        "--response",
      ]),
    );
    assert(
      all.some((x) => x.id === state.ruleId),
      "rule missing from list",
    );
  });
  await test("B5", "disable and delete need --yes; disable then enable round-trips", () => {
    need(state.ruleId, "B3");
    const base = [
      "privileged-controls",
      "rule",
      "disable",
      state.ruleId,
      "--organizationid",
      config.orgId,
    ];
    refused(bw("admin", [...base, "--response"]), /--yes/i, "disable without --yes");
    const off = bw("admin", [...base, "--yes", "--response"]);
    succeeded(off, "disable");
    assert(off.data.enabled === false, "rule still enabled after disable");
    const on = bw("admin", [
      "privileged-controls",
      "rule",
      "enable",
      state.ruleId,
      "--organizationid",
      config.orgId,
      "--response",
    ]);
    succeeded(on, "enable");
    assert(on.data.enabled === true, "rule not enabled after enable");
    refused(
      bw("admin", [
        "privileged-controls",
        "rule",
        "delete",
        state.ruleId,
        "--organizationid",
        config.orgId,
        "--response",
      ]),
      /--yes/i,
      "delete without --yes",
    );
  });
  await test("B6", "bypassable lists collections that expose the rule's ciphers", () => {
    need(state.ruleId, "B3");
    succeeded(
      bw("admin", [
        "privileged-controls",
        "rule",
        "bypassable",
        state.ruleId,
        "--organizationid",
        config.orgId,
        "--response",
      ]),
      "bypassable",
    );
  });

  // C. Request, approve, lease -------------------------------------------------------------------
  await test("C1", "request status shows a gated item with no request as privileged", () => {
    need(state.ruleId, "B3");
    const r = bw("user", [
      "privileged-controls",
      "request",
      "status",
      state.cipherId,
      "--response",
    ]);
    succeeded(r, "request status");
    assert(r.data.badgeState === "privileged", `badgeState=${r.data.badgeState}`);
  });
  await test("C2", "a human-approval request without a reason is refused", () => {
    need(state.ruleId, "B3");
    refused(
      bw("user", [
        "privileged-controls",
        "request",
        "create",
        state.cipherId,
        "--start",
        iso(15_000),
        "--end",
        iso(3_600_000),
        "--response",
      ]),
      /reason is required/i,
      "no reason",
    );
  });
  await test("C3", "the member submits a request; it is pending and echoes no reason", async () => {
    need(state.ruleId, "B3");
    const d = await submitRequest("CLI e2e: approval flow", 45_000);
    state.requestId = d.id;
    (state.requests ??= []).push(d.id);
    assert(d.status === "pending" && d.approvalMode === "human", JSON.stringify(d));
    assert(!/approval flow/.test(JSON.stringify(d)), "the reason was echoed back");
  });
  await test("C4", "request list/get show the pending request", () => {
    need(state.requestId, "C3");
    const rows = list(
      bw("user", ["privileged-controls", "request", "list", "--status", "pending", "--response"]),
    );
    assert(
      rows.some((x) => x.id === state.requestId),
      "missing from request list",
    );
    const g = bw("user", ["privileged-controls", "request", "get", state.requestId, "--response"]);
    succeeded(g, "request get");
    assert(g.data.status === "pending", `status=${g.data.status}`);
  });
  const NOT_AN_APPROVER =
    /You are not an approver\. Approving requests needs Manage on a governed collection/;
  // Approver status follows the web (`hasApprovalPrivileges`): Manage on a collection of the org, or
  // the ability to edit all items. A non-approver is refused up front, not shown an empty inbox.
  const inboxOf = (p) => {
    const r = bw(p, ["privileged-controls", "approval", "inbox", "--response"]);
    if (!r.ok) {
      assert(
        NOT_AN_APPROVER.test(r.text),
        `${p}: refused with an unexpected message: ${r.text.slice(0, 200)}`,
      );
      return { refused: true, ids: [] };
    }
    return { refused: false, ids: list(r).map((x) => x.id) };
  };
  await test(
    "C5",
    "the owner's inbox shows the request; a non-approver is refused and nobody sees their own request",
    () => {
      need(state.requestId, "C3");
      assert(inboxOf("owner").ids.includes(state.requestId), "owner inbox is missing the request");
      const user = inboxOf("user");
      assert(
        !user.ids.includes(state.requestId),
        "the requester sees their own request in the inbox",
      );
      const custom = inboxOf("custom");
      assert(
        custom.refused,
        "a reports-only custom member (no Manage on a collection) should be refused",
      );
    },
  );
  {
    const admin = state.requestId ? inboxOf("admin") : { refused: false, ids: [] };
    observe(
      "C5b",
      "admin without all-items access or Manage (follows the web's approver rule)",
      admin.refused
        ? "refused: not an approver"
        : `allowed; sees the request: ${admin.ids.includes(state.requestId)}`,
    );
  }
  await test("C5c", "every approval command refuses a non-approver before doing anything", () => {
    need(state.requestId, "C3");
    const refusedAll = [
      ["privileged-controls", "approval", "history"],
      ["privileged-controls", "approval", "managed-leases"],
      ["privileged-controls", "approval", "approve", state.requestId],
      ["privileged-controls", "approval", "deny", state.requestId, "--comment", "x"],
    ];
    for (const args of refusedAll) {
      refused(bw("custom", [...args, "--response"]), NOT_AN_APPROVER, `custom ${args[2]}`);
    }
  });
  await test("C6", "the requester cannot approve their own request", () => {
    need(state.requestId, "C3");
    refused(
      bw("user", ["privileged-controls", "approval", "approve", state.requestId, "--response"]),
      /not an approver|not found|do not have access|cannot approve/i,
      "self-approve",
    );
  });
  await test("C7", "the owner approves; the request awaits activation", () => {
    need(state.requestId, "C3");
    const r = bw("owner", [
      "privileged-controls",
      "approval",
      "approve",
      state.requestId,
      "--comment",
      "e2e ok",
      "--response",
    ]);
    succeeded(r, "approve");
    assert(r.data.status === "approved" && r.data.verdict === "approve", JSON.stringify(r.data));
    const g = bw("user", ["privileged-controls", "request", "get", state.requestId, "--response"]);
    assert(g.data.awaitingActivation === true, "awaitingActivation should be true");
  });
  await test(
    "C8",
    "activating before the window opens is refused with code window-not-started",
    () => {
      need(state.requestId, "C3");
      if (Date.now() >= Date.parse(state.windowStart)) {
        skip("the window opened before this check ran; raise the start offset in C3");
      }
      const r = bw("user", [
        "privileged-controls",
        "request",
        "activate",
        state.requestId,
        "--response",
      ]);
      assert(!r.ok, "activation succeeded before the window");
      assert(
        r.json?.data?.code === "window-not-started",
        `code=${r.json?.data?.code} ${r.text.slice(0, 160)}`,
      );
    },
  );
  await test("C9", "activating once the window is open starts an active lease", async () => {
    need(state.requestId, "C3");
    const wait = Date.parse(state.windowStart) - Date.now() + 2_000;
    if (wait > 0) {
      await sleep(wait);
    }
    const r = bw("user", [
      "privileged-controls",
      "request",
      "activate",
      state.requestId,
      "--response",
    ]);
    succeeded(r, "activate");
    state.leaseId = r.data.leaseId;
    (state.leases ??= []).push(r.data.leaseId);
    assert(r.data.status === "active", `status=${r.data.status}`);
  });
  await test("C10", "lease list shows the active lease", () => {
    need(state.leaseId, "C9");
    const rows = list(bw("user", ["privileged-controls", "lease", "list", "--response"]));
    assert(
      rows.some((x) => x.id === state.leaseId && x.status === "active"),
      "lease not listed as active",
    );
    // Regression: --active once read the SDK's list_active, which is the approver view and is empty
    // for an ordinary lease holder.
    const live = list(
      bw("user", ["privileged-controls", "lease", "list", "--active", "--response"]),
    );
    assert(
      live.some((x) => x.id === state.leaseId),
      "lease holder's own lease missing from --active",
    );
    state.notAfter = rows.find((x) => x.id === state.leaseId).notAfter;
  });
  await test(
    "C11",
    "reveal prints each field under a live lease (sizes only) and is refused without one",
    () => {
      need(state.leaseId, "C9");
      const sizes = [];
      for (const field of ["username", "password", "uri"]) {
        const r = bw(
          "user",
          ["privileged-controls", "lease", "reveal", state.cipherId, "--field", field],
          {
            redact: true,
          },
        );
        assert(r.ok && r.bytes > 0, `reveal ${field} failed or was empty: ${r.text.slice(0, 120)}`);
        sizes.push(`${field}=${r.bytes}b`);
      }
      const nolease = bw(
        "custom",
        ["privileged-controls", "lease", "reveal", state.cipherId, "--field", "password"],
        { redact: true },
      );
      assert(!nolease.ok && nolease.bytes === 0, "a member without a lease received output");
      return sizes.join(" ");
    },
  );
  await test(
    "C12",
    "extend needs a reason; with one it moves the lease end; a second extension is refused",
    () => {
      need(state.leaseId, "C9");
      refused(
        bw("user", [
          "privileged-controls",
          "lease",
          "extend",
          state.leaseId,
          "--duration",
          "10m",
          "--response",
        ]),
        /reason/i,
        "extend without reason",
      );
      const r = bw(
        "user",
        [
          "privileged-controls",
          "lease",
          "extend",
          state.leaseId,
          "--duration",
          "10m",
          "--reasonstdin",
          "--response",
        ],
        { stdin: "CLI e2e extend" },
      );
      succeeded(r, "extend");
      assert(
        Date.parse(r.data.notAfter) > Date.parse(state.notAfter),
        `lease end did not move: ${state.notAfter} -> ${r.data.notAfter}`,
      );
      refused(
        bw(
          "user",
          [
            "privileged-controls",
            "lease",
            "extend",
            state.leaseId,
            "--duration",
            "10m",
            "--reasonstdin",
            "--response",
          ],
          { stdin: "again" },
        ),
        /./,
        "a second extension (one per lease)",
      );
      return `status=${r.data.status}, end moved ${state.notAfter} -> ${r.data.notAfter}`;
    },
  );
  await test("C13", "the owner's managed-leases lists the live lease", () => {
    need(state.leaseId, "C9");
    const rows = list(
      bw("owner", ["privileged-controls", "approval", "managed-leases", "--response"]),
    );
    assert(
      rows.some((x) => (x.id ?? x.leaseId) === state.leaseId),
      "lease not in managed-leases",
    );
  });
  await test("C14", "the owner revokes the lease; reveal is refused afterwards", () => {
    need(state.leaseId, "C9");
    refused(
      bw("owner", ["privileged-controls", "approval", "revoke-lease", state.leaseId, "--response"]),
      /--yes/i,
      "revoke without --yes",
    );
    const r = bw("owner", [
      "privileged-controls",
      "approval",
      "revoke-lease",
      state.leaseId,
      "--reason",
      "e2e",
      "--yes",
      "--response",
    ]);
    succeeded(r, "revoke-lease");
    const after = bw(
      "user",
      ["privileged-controls", "lease", "reveal", state.cipherId, "--field", "password"],
      {
        redact: true,
      },
    );
    assert(!after.ok && after.bytes === 0, "reveal still works after the lease was revoked");
  });

  // D. Deny and cancel -----------------------------------------------------------------------------
  await test(
    "D1",
    "deny needs a comment; a denied request is denied for the requester",
    async () => {
      need(state.ruleId, "B3");
      const d = await submitRequest("CLI e2e: deny flow");
      (state.requests ??= []).push(d.id);
      refused(
        bw("owner", ["privileged-controls", "approval", "deny", d.id, "--response"]),
        /comment/i,
        "deny without comment",
      );
      succeeded(
        bw("owner", [
          "privileged-controls",
          "approval",
          "deny",
          d.id,
          "--comment",
          "not needed",
          "--response",
        ]),
        "deny",
      );
      const g = bw("user", ["privileged-controls", "request", "get", d.id, "--response"]);
      assert(g.data.status === "denied", `status=${g.data.status}`);
      state.deniedId = d.id;
    },
  );
  await test("D2", "the requester can cancel a pending request", async () => {
    need(state.ruleId, "B3");
    const d = await submitRequest("CLI e2e: cancel flow");
    (state.requests ??= []).push(d.id);
    succeeded(
      bw("user", ["privileged-controls", "request", "cancel", d.id, "--response"]),
      "cancel",
    );
    const g = bw("user", ["privileged-controls", "request", "get", d.id, "--response"]);
    assert(g.data.status === "canceled", `status=${g.data.status}`);
  });
  await test("D3", "approval history lists the decided requests", () => {
    need(state.deniedId, "D1");
    const rows = list(bw("owner", ["privileged-controls", "approval", "history", "--response"]));
    for (const id of [state.requestId, state.deniedId]) {
      assert(
        rows.some((x) => x.id === id),
        `request ${id.slice(0, 8)} missing from history`,
      );
    }
  });
}

// ---- run ----------------------------------------------------------------------------------------

let setupError;
try {
  setup();
  await suite();
} catch (e) {
  setupError = e;
  console.error(`\nSETUP/RUN ERROR: ${e.message}`);
}
const cleanupNotes = teardown();

const count = (s) => results.filter((r) => r.status === s).length;
const summary = {
  runId,
  pass: count("pass"),
  fail: count("fail"),
  skip: count("skip"),
  observe: count("observe"),
  setupError: setupError?.message,
  cleanupNotes,
  results,
};
mkdirSync(config.reportDir, { recursive: true });
writeFileSync(join(config.reportDir, "report.json"), JSON.stringify(summary, null, 2));
console.log(
  `\n${summary.pass} passed, ${summary.fail} failed, ${summary.skip} skipped, ${summary.observe} to review` +
    `\nreport: ${join(config.reportDir, "report.json")}` +
    (cleanupNotes.length ? `\ncleanup issues: ${cleanupNotes.join("; ")}` : "\ncleanup: ok"),
);
process.exit(summary.fail || setupError ? 1 : 0);
