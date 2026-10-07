import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OpenShellDetectionResult } from "../models/openshell";

import { OpenShellEnabledState } from "./openshell-enabled-state";
import {
  OpenShellManagementExec,
  OpenShellManagementExecResult,
} from "./openshell-management.service";
import { OpenShellRequestsService, parseOpenShellRequests } from "./openshell-requests.service";

const CLI = "/opt/homebrew/bin/openshell";
const G = "--gateway=work";
const ID = "927d2e27-780a-4efb-ba16-b8fc1cd0fe32";
const ID2 = "a27d2e27-780a-4efb-ba16-b8fc1cd0fe33";

// Captured from openshell 0.1.2 (`rule get bw-live`), 2026-10-07.
const REAL_OUTPUT = `Network Rules:  (version 1, 1 chunk)

  Chunk: ${ID}
  Status: pending
  Rule: allow_httpbin_org_443
  Binary: /usr/bin/curl
  Confidence: 65%
  Rationale: Allow curl to connect to httpbin.org:443 (HTTPS).
  Prover: prover: no new findings
  Candidate: 0a61b73ed100
  Endpoints: httpbin.org:443 [L7 rest, access=read-only]
  Binaries: /usr/bin/curl
  Hits: 2 (first seen 2026-10-06 21:04:21, last seen 2026-10-06 21:10:29)
`;

const FLAGGED_OUTPUT = REAL_OUTPUT.replace(
  "Prover: prover: no new findings",
  "Prover: prover: 1 finding: reaches a cloud metadata address",
);

function detection(overrides: Partial<OpenShellDetectionResult> = {}): OpenShellDetectionResult {
  return {
    present: true,
    platformSupported: true,
    cliPath: CLI,
    gateways: [
      {
        name: "work",
        endpoint: "https://127.0.0.1:2",
        authMode: "mtls",
        active: true,
        authSupported: true,
      },
    ],
    gatewayConfigPathHint: "/x/gateway.toml",
    ...overrides,
  };
}

type Handler = (args: string[]) => Partial<OpenShellManagementExecResult>;

function create(
  handler: Handler = () => ({ stdout: REAL_OUTPUT }),
  options: {
    det?: OpenShellDetectionResult;
    available?: boolean;
    on?: boolean;
    mode?: number;
  } = {},
) {
  const calls: { file: string; args: string[]; timeoutMs: number }[] = [];
  const exec: OpenShellManagementExec = {
    run: jest.fn(async (file: string, args: string[], timeoutMs: number) => {
      calls.push({ file, args, timeoutMs });
      return { code: 0, stdout: "", stderr: "", ...handler(args) };
    }),
  };
  const state = new OpenShellEnabledState();
  state.set(options.on ?? true);
  const log = mock<LogService>();
  const service = new OpenShellRequestsService(
    log,
    async () => options.det ?? detection(),
    async () => options.available ?? true,
    state,
    exec,
    { stat: jest.fn(async () => ({ mode: options.mode ?? 0o100755 })) },
  );
  return { service, calls, log };
}

describe("parseOpenShellRequests", () => {
  it("reads the real `rule get` output", () => {
    expect(parseOpenShellRequests(REAL_OUTPUT)).toEqual([
      {
        id: ID,
        status: "pending",
        rule: "allow_httpbin_org_443",
        endpoints: [{ host: "httpbin.org", port: 443, access: "read-only" }],
        programs: ["/usr/bin/curl"],
        rationale: "Allow curl to connect to httpbin.org:443 (HTTPS).",
        flagged: false,
        flagNote: "",
        hits: 2,
        firstSeen: "2026-10-06 21:04:21",
        lastSeen: "2026-10-06 21:10:29",
      },
    ]);
  });

  it("reads the empty listing and rejects unknown output", () => {
    expect(parseOpenShellRequests("No network rules for sandbox 'x'\n")).toEqual([]);
    expect(parseOpenShellRequests("")).toEqual([]);
    expect(parseOpenShellRequests("something else entirely")).toBeNull();
  });

  it("marks a chunk flagged when the prover reports anything but no findings", () => {
    const [request] = parseOpenShellRequests(FLAGGED_OUTPUT);
    expect(request.flagged).toBe(true);
    expect(request.flagNote).toContain("cloud metadata");
  });

  it("marks a chunk flagged for a security line and when the prover line is empty", () => {
    const security = REAL_OUTPUT.replace(
      "  Candidate:",
      "  Security flags: wildcard host\n  Candidate:",
    );
    expect(parseOpenShellRequests(security)[0].flagged).toBe(true);
    const empty = REAL_OUTPUT.replace("Prover: prover: no new findings", "Prover:");
    expect(parseOpenShellRequests(empty)[0].flagged).toBe(true);
    const none = REAL_OUTPUT.replace("  Candidate:", "  Security flags: none\n  Candidate:");
    expect(parseOpenShellRequests(none)[0].flagged).toBe(false);
  });

  it("reads several chunks and several endpoints, and skips a chunk with a bad id or status", () => {
    const text = `Network Rules:  (version 2, 3 chunks)

  Chunk: ${ID}
  Status: approved
  Endpoints: a.example.com:443 [L7 rest, access=read-write], [::1]:8080, bad:99999, b.example.com:80

  Chunk: --evil
  Status: pending
  Endpoints: x.example.com:443

  Chunk: ${ID2}
  Status: weird
`;
    const parsed = parseOpenShellRequests(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].status).toBe("approved");
    expect(parsed[0].endpoints).toEqual([
      { host: "a.example.com", port: 443, access: "read-write" },
      { host: "[::1]", port: 8080, access: "" },
      { host: "b.example.com", port: 80, access: "" },
    ]);
  });

  it("strips control and bidi characters and caps untrusted text", () => {
    const evil = REAL_OUTPUT.replace(
      "Allow curl to connect to httpbin.org:443 (HTTPS).",
      `Evil \u202eexe.txt\u200b \u0007bell ${"x".repeat(2000)}`,
    );
    const [request] = parseOpenShellRequests(evil);
    expect(request.rationale).not.toMatch(/[\u202e\u200b]/);
    expect(request.rationale).not.toContain("\u0007");
    expect(request.rationale.length).toBeLessThanOrEqual(500);
    expect(request.rationale.startsWith("Evil exe.txt bell")).toBe(true);
  });
});

describe("OpenShellRequestsService.listRequests", () => {
  it("runs `rule get` with the status filter, an argument array and the read timeout", async () => {
    const { service, calls } = create();
    const result = await service.listRequests({ sandboxName: "alpha", status: "pending" });
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      file: CLI,
      args: ["rule", "get", G, "--status=pending", "alpha"],
      timeoutMs: 15_000,
    });
  });

  it("omits the filter when no status is given", async () => {
    const { service, calls } = create();
    await service.listRequests({ sandboxName: "alpha" });
    expect(calls[0].args).toEqual(["rule", "get", G, "alpha"]);
  });

  it("only returns requests of the asked status", async () => {
    const { service } = create(() => ({
      stdout: REAL_OUTPUT.replace("Status: pending", "Status: approved"),
    }));
    expect((await service.listRequests({ sandboxName: "alpha", status: "pending" })).data).toEqual(
      [],
    );
  });

  it.each([
    [null],
    [[]],
    [{}],
    [{ sandboxName: "-x" }],
    [{ sandboxName: "a b" }],
    [{ sandboxName: "alpha", status: "all" }],
    [{ sandboxName: "alpha", status: "--include-security-flagged" }],
    [{ sandboxName: 5 }],
  ])("rejects %j before any process", async (request) => {
    const { service, calls } = create();
    expect(await service.listRequests(request)).toEqual({ ok: false, error: "invalidInput" });
    expect(calls).toHaveLength(0);
  });

  it("is unsupported when the toggle is off or management is unavailable, without a process", async () => {
    for (const options of [{ on: false }, { available: false }]) {
      const { service, calls } = create(undefined, options);
      expect(await service.listRequests({ sandboxName: "alpha" })).toEqual({
        ok: false,
        error: "unsupported",
      });
      expect(calls).toHaveLength(0);
    }
  });

  it("reports a missing CLI, an unwritable binary and unsupported platforms", async () => {
    expect(
      await create(undefined, { det: detection({ cliPath: null }) }).service.listRequests({
        sandboxName: "a",
      }),
    ).toEqual({ ok: false, error: "cliMissing" });
    const writable = create(undefined, { mode: 0o100775 });
    expect((await writable.service.listRequests({ sandboxName: "a" })).error).toBe("failed");
    expect(writable.calls).toHaveLength(0);
    expect(
      (
        await create(undefined, {
          det: detection({ platformSupported: false }),
        }).service.listRequests({ sandboxName: "a" })
      ).error,
    ).toBe("unsupported");
  });

  it("maps failures and never returns an unreadable listing as empty", async () => {
    const down = create(() => ({ code: 1, stderr: "transport error: connection refused" }));
    expect((await down.service.listRequests({ sandboxName: "a" })).error).toBe(
      "gatewayUnreachable",
    );
    const missing = create(() => ({ code: 1, stderr: "sandbox not found" }));
    expect((await missing.service.listRequests({ sandboxName: "a" })).error).toBe("notFound");
    const garbage = create(() => ({ stdout: "<html>nope</html>" }));
    const result = await garbage.service.listRequests({ sandboxName: "a" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("failed");
  });

  it("never throws across IPC", async () => {
    const { service } = create();
    (service as unknown as { exec: OpenShellManagementExec }).exec = {
      run: jest.fn().mockRejectedValue(new Error("boom")),
    };
    expect(await service.listRequests({ sandboxName: "a" })).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("OpenShellRequestsService.approveRequest", () => {
  it("re-reads the pending list, then approves exactly that chunk", async () => {
    const { service, calls } = create((args) => (args[1] === "get" ? { stdout: REAL_OUTPUT } : {}));
    const result = await service.approveRequest({ sandboxName: "alpha", chunkId: ID });
    expect(result).toEqual({ ok: true, data: undefined });
    expect(calls.map((c) => c.args)).toEqual([
      ["rule", "get", G, "--status=pending", "alpha"],
      ["rule", "approve", G, `--chunk-id=${ID}`, "alpha"],
    ]);
    expect(calls[1].timeoutMs).toBe(60_000);
  });

  it("never builds approve-all or the security-flagged option", async () => {
    const { service, calls } = create((args) =>
      args[1] === "get" ? { stdout: FLAGGED_OUTPUT } : {},
    );
    await service.approveRequest({ sandboxName: "alpha", chunkId: ID, confirmFlagged: true });
    const joined = calls.flatMap((c) => c.args).join(" ");
    expect(joined).not.toMatch(/approve-all|include-security-flagged|clear/);
  });

  it("refuses a flagged request without confirmation and runs no approve", async () => {
    const { service, calls } = create(() => ({ stdout: FLAGGED_OUTPUT }));
    expect(await service.approveRequest({ sandboxName: "alpha", chunkId: ID })).toEqual({
      ok: false,
      error: "invalidInput",
    });
    expect(
      await service.approveRequest({ sandboxName: "alpha", chunkId: ID, confirmFlagged: false }),
    ).toEqual({ ok: false, error: "invalidInput" });
    expect(calls.every((c) => c.args[1] === "get")).toBe(true);
  });

  it("approves a flagged request once the caller confirmed it", async () => {
    const { service, calls } = create((args) =>
      args[1] === "get" ? { stdout: FLAGGED_OUTPUT } : {},
    );
    expect(
      (await service.approveRequest({ sandboxName: "alpha", chunkId: ID, confirmFlagged: true }))
        .ok,
    ).toBe(true);
    expect(calls[calls.length - 1].args[1]).toBe("approve");
  });

  it("is notFound for an id that isn't pending, without running approve", async () => {
    const { service, calls } = create(() => ({ stdout: REAL_OUTPUT }));
    expect(await service.approveRequest({ sandboxName: "alpha", chunkId: ID2 })).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(calls).toHaveLength(1);
  });

  it.each([
    [{ sandboxName: "alpha", chunkId: "--chunk-id=1" }],
    [{ sandboxName: "alpha", chunkId: "not-a-uuid" }],
    [{ sandboxName: "alpha", chunkId: `${ID} --include-security-flagged` }],
    [{ sandboxName: "-alpha", chunkId: ID }],
    [{ sandboxName: "alpha", chunkId: ID, confirmFlagged: "yes" }],
    [{ chunkId: ID }],
    [undefined],
  ])("rejects %j before any process", async (request) => {
    const { service, calls } = create();
    expect(await service.approveRequest(request)).toEqual({ ok: false, error: "invalidInput" });
    expect(calls).toHaveLength(0);
  });

  it("surfaces an approve failure with a scrubbed message", async () => {
    const { service } = create((args) =>
      args[1] === "get"
        ? { stdout: REAL_OUTPUT }
        : { code: 1, stderr: "failed: token bw://item/abc123 sk_live_abcdefghij1234567890" },
    );
    const result = await service.approveRequest({ sandboxName: "alpha", chunkId: ID });
    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/bw:\/\/|sk_live/);
  });

  it("is unsupported with the toggle off, without a process", async () => {
    const { service, calls } = create(undefined, { on: false });
    expect(await service.approveRequest({ sandboxName: "alpha", chunkId: ID })).toEqual({
      ok: false,
      error: "unsupported",
    });
    expect(calls).toHaveLength(0);
  });
});

describe("OpenShellRequestsService.rejectRequest", () => {
  it("runs `rule reject` with the chunk id and a cleaned reason as one argument each", async () => {
    const { service, calls } = create();
    const result = await service.rejectRequest({
      sandboxName: "alpha",
      chunkId: ID,
      reason: "  not \u202eneeded\u0007 here  ",
    });
    expect(result).toEqual({ ok: true, data: undefined });
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual([
      "rule",
      "reject",
      G,
      `--chunk-id=${ID}`,
      "--reason=not needed here",
      "alpha",
    ]);
  });

  it("keeps a reason that looks like a flag as the value of --reason", async () => {
    const { service, calls } = create();
    await service.rejectRequest({ sandboxName: "alpha", chunkId: ID, reason: "--clear; rm -rf /" });
    expect(calls[0].args).toContain("--reason=--clear; rm -rf /");
    expect(calls[0].args).toHaveLength(6);
  });

  it("omits an empty reason and caps a long one", async () => {
    const empty = create();
    await empty.service.rejectRequest({ sandboxName: "alpha", chunkId: ID, reason: "   " });
    expect(empty.calls[0].args).toEqual(["rule", "reject", G, `--chunk-id=${ID}`, "alpha"]);
    const long = create();
    await long.service.rejectRequest({
      sandboxName: "alpha",
      chunkId: ID,
      reason: "x".repeat(1000),
    });
    expect(long.calls[0].args[4]).toBe(`--reason=${"x".repeat(200)}`);
  });

  it.each([
    [{ sandboxName: "alpha", chunkId: "x" }],
    [{ sandboxName: "alpha", chunkId: ID, reason: 5 }],
    [{ sandboxName: "a b", chunkId: ID }],
    [null],
  ])("rejects %j before any process", async (request) => {
    const { service, calls } = create();
    expect(await service.rejectRequest(request)).toEqual({ ok: false, error: "invalidInput" });
    expect(calls).toHaveLength(0);
  });

  it("reports a timed-out reject as failed, not unreachable", async () => {
    const { service } = create(() => ({ code: 1, timedOut: true, stderr: "timed out" }));
    const result = await service.rejectRequest({ sandboxName: "alpha", chunkId: ID });
    expect(result.error).toBe("failed");
  });
});
