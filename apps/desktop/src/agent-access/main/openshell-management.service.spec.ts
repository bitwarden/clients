import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OpenShellDetectionResult } from "../models/openshell";

import {
  OpenShellCredentialRegistryFs,
  OpenShellCredentialRegistryService,
} from "./openshell-credential-registry.service";
import { OpenShellEnabledState } from "./openshell-enabled-state";
import {
  OpenShellManagementExec,
  OpenShellManagementExecResult,
  OpenShellManagementFs,
  OpenShellManagementService,
  scrubOpenShellMessage,
} from "./openshell-management.service";

const CLI = "/opt/homebrew/bin/openshell";
const ITEM_ID = "0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33";
const SECRET_ID = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";
const G = "--gateway=work";

function detection(overrides: Partial<OpenShellDetectionResult> = {}): OpenShellDetectionResult {
  return {
    present: true,
    platformSupported: true,
    cliPath: CLI,
    gateways: [
      {
        name: "home",
        endpoint: "https://127.0.0.1:1",
        authMode: "mtls",
        active: false,
        authSupported: true,
      },
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

function fakeExec(handler: Handler = () => ({})) {
  const calls: { file: string; args: string[]; timeoutMs: number }[] = [];
  const exec: OpenShellManagementExec = {
    run: jest.fn(async (file: string, args: string[], timeoutMs: number) => {
      calls.push({ file, args, timeoutMs });
      return { code: 0, stdout: "", stderr: "", ...handler(args) };
    }),
  };
  return { exec, calls };
}

const PROFILES = JSON.stringify({
  profiles: [
    {
      id: "github",
      display_name: "GitHub",
      credentials: [{ name: "token", env_vars: ["GH_TOKEN", "GH_USER", "OTHER"], required: true }],
    },
  ],
});

function fakeFs(modes: Record<string, number> = {}): OpenShellManagementFs {
  return { stat: jest.fn(async (p: string) => ({ mode: modes[p] ?? 0o100755 })) };
}

function enabled(on = true): OpenShellEnabledState {
  const state = new OpenShellEnabledState();
  state.set(on);
  return state;
}

function fakeRegistry(initial: string | null = null) {
  const state = { content: initial };
  const adapter: OpenShellCredentialRegistryFs = {
    read: jest.fn(async () => state.content),
    writeAtomic: jest.fn(async (_path: string, content: string) => {
      state.content = content;
    }),
  };
  const registry = new OpenShellCredentialRegistryService(mock<LogService>(), "/data", adapter);
  return { registry, adapter, state };
}

function create(
  handler: Handler = () => ({}),
  options: {
    det?: OpenShellDetectionResult;
    available?: boolean;
    registryContent?: string | null;
    modes?: Record<string, number>;
    enabledState?: OpenShellEnabledState;
  } = {},
) {
  const withProfiles: Handler = (args) => {
    const result = handler(args);
    if (result.stdout) {
      return result;
    }
    if (args[0] === "provider" && args[1] === "list-profiles") {
      return { ...result, stdout: PROFILES };
    }
    return args[0] === "sandbox" && args[1] === "list" ? { ...result, stdout: "[]" } : result;
  };
  const { exec, calls } = fakeExec(withProfiles);
  const { registry, adapter, state } = fakeRegistry(options.registryContent ?? null);
  const log = mock<LogService>();
  const service = new OpenShellManagementService(
    log,
    async () => options.det ?? detection(),
    registry,
    async () => options.available ?? true,
    exec,
    fakeFs(options.modes),
    options.enabledState ?? enabled(),
  );
  return { service, calls, registry, adapter, state, log };
}

const MANAGED = JSON.stringify({
  version: 1,
  entries: [
    {
      gatewayName: "work",
      sandboxName: "box",
      providerName: "github-box",
      profileId: "github",
      bindings: [
        { envVar: "GH_TOKEN", resourceType: "secret", id: SECRET_ID, field: "value", label: "GH" },
      ],
      createdAtMs: 5,
    },
  ],
});

describe("OpenShellManagementService", () => {
  describe("gating and process setup", () => {
    it("is unsupported, with no process, when OpenShell is not enabled and set up", async () => {
      const { service, calls } = create(() => ({}), { available: false });
      expect(await service.listSandboxes()).toEqual({ ok: false, error: "unsupported" });
      expect(calls).toHaveLength(0);
    });

    it("is unsupported when detection says the platform is not supported or OpenShell is absent", async () => {
      for (const det of [detection({ platformSupported: false }), detection({ present: false })]) {
        const { service, calls } = create(() => ({}), { det });
        expect(await service.listProfiles()).toEqual({ ok: false, error: "unsupported" });
        expect(calls).toHaveLength(0);
      }
    });

    it("reports cliMissing when detection has no cliPath", async () => {
      const { service, calls } = create(() => ({}), { det: detection({ cliPath: undefined }) });
      expect(await service.listProfiles()).toEqual({ ok: false, error: "cliMissing" });
      expect(calls).toHaveLength(0);
    });

    it("reports cliMissing when the binary cannot be started", async () => {
      const { service } = create(() => ({ code: 127, spawnFailed: true }));
      expect(await service.listProfiles()).toEqual({ ok: false, error: "cliMissing" });
    });

    it("runs the detected absolute cliPath with the active gateway, JSON output and the read timeout", async () => {
      const { service, calls } = create(() => ({ stdout: "[]" }));
      await service.listProfiles();
      expect(calls).toEqual([
        {
          file: CLI,
          args: ["provider", "list-profiles", G, "-o", "json"],
          timeoutMs: 15_000,
        },
      ]);
    });

    it("falls back to the first gateway, then the default name", async () => {
      const first = create(() => ({ stdout: "[]" }), {
        det: detection({
          gateways: [
            { name: "only", endpoint: "e", authMode: "mtls", active: false, authSupported: true },
          ],
        }),
      });
      await first.service.listProfiles();
      expect(first.calls[0].args).toContain("--gateway=only");

      const none = create(() => ({ stdout: "[]" }), { det: detection({ gateways: [] }) });
      await none.service.listProfiles();
      expect(none.calls[0].args).toContain("--gateway=openshell");
    });

    it("never throws when the exec adapter rejects", async () => {
      const { exec } = fakeExec();
      (exec.run as jest.Mock).mockRejectedValue(new Error("boom"));
      const service = new OpenShellManagementService(
        mock<LogService>(),
        async () => detection(),
        fakeRegistry().registry,
        async () => true,
        exec,
        fakeFs(),
        enabled(),
      );
      expect(await service.listProfiles()).toEqual({ ok: false, error: "failed" });
    });

    it("never throws when detection rejects", async () => {
      const service = new OpenShellManagementService(
        mock<LogService>(),
        async () => {
          throw new Error("boom");
        },
        fakeRegistry().registry,
        async () => true,
        fakeExec().exec,
        fakeFs(),
        enabled(),
      );
      expect(await service.listSandboxes()).toEqual({ ok: false, error: "failed" });
    });
  });

  describe("error mapping", () => {
    const cases: [string, string][] = [
      ["connection refused (os error 61)", "gatewayUnreachable"],
      ["transport error: tls handshake failed", "gatewayUnreachable"],
      ["timed out", "gatewayUnreachable"],
      ["sandbox 'box' not found", "notFound"],
      ["rpc error: NotFound", "notFound"],
      ["provider 'x' already exists", "alreadyExists"],
      ["error: unrecognized subcommand 'stop'", "unsupported"],
      ["something else went wrong", "failed"],
    ];
    it.each(cases)("maps stderr %p to %s", async (stderr, error) => {
      const { service } = create(() => ({ code: 1, stderr }));
      const result = await service.sandboxAction({ action: "stop", name: "box" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe("scrubbing", () => {
    it("removes bw:// references and long token-like runs, and truncates to 300 characters", async () => {
      const stderr = `failed for bw://item/${ITEM_ID}#password with token ghp_abcdefghijklmnopqrstuvwxyz0123456789 ${"x ".repeat(400)}`;
      const { service } = create(() => ({ code: 1, stderr }));
      const result = await service.sandboxAction({ action: "start", name: "box" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBeDefined();
        expect(result.message).not.toContain("bw://");
        expect(result.message).not.toContain(ITEM_ID);
        expect(result.message).not.toContain("ghp_");
        expect(result.message!.length).toBeLessThanOrEqual(300);
      }
    });

    it("does not log the stderr's bw:// reference either", async () => {
      const { service, log } = create(() => ({ code: 1, stderr: `bad bw://secret/${SECRET_ID}` }));
      await service.sandboxAction({ action: "stop", name: "box" });
      const logged = JSON.stringify((log.warning as jest.Mock).mock.calls);
      expect(logged).not.toContain("bw://");
      expect(logged).not.toContain(SECRET_ID);
    });

    it("scrubOpenShellMessage leaves ordinary short text alone", () => {
      expect(scrubOpenShellMessage("sandbox 'box' not found\n")).toBe("sandbox 'box' not found");
    });
  });

  describe("listSandboxes", () => {
    const LIST = JSON.stringify({
      sandboxes: [
        { name: "a", id: "id-a", phase: "Ready", created_at: "2026-10-01T00:00:00Z", extra: 1 },
        { name: "b", id: "id-b", phase: "Stopped", created_at: 1760000000000 },
        { name: "c", id: "id-c", phase: "Ready", created_at: "t" },
      ],
    });

    it("lists sandboxes and counts providers per sandbox, null on a per-sandbox failure", async () => {
      const { service, calls } = create((args) => {
        if (args[0] === "sandbox" && args[1] === "list") {
          return { stdout: LIST };
        }
        const sandbox = args[args.length - 1];
        if (sandbox === "a") {
          return { stdout: JSON.stringify({ providers: ["p1", { name: "p2", type: "github" }] }) };
        }
        if (sandbox === "b") {
          return { code: 1, stderr: "boom" };
        }
        return { stdout: JSON.stringify({ providers: [] }) };
      });
      const result = await service.listSandboxes();
      expect(result).toEqual({
        ok: true,
        data: [
          {
            name: "a",
            id: "id-a",
            phase: "Ready",
            createdAt: "2026-10-01T00:00:00Z",
            providerCount: 2,
          },
          {
            name: "b",
            id: "id-b",
            phase: "Stopped",
            createdAt: "1760000000000",
            providerCount: null,
          },
          { name: "c", id: "id-c", phase: "Ready", createdAt: "t", providerCount: 0 },
        ],
      });
      expect(calls[0].args).toEqual(["sandbox", "list", G, "-o", "json"]);
      expect(calls.slice(1).map((c) => c.args)).toEqual(
        expect.arrayContaining([
          ["sandbox", "provider", "list", G, "-o", "json", "a"],
          ["sandbox", "provider", "list", G, "-o", "json", "b"],
          ["sandbox", "provider", "list", G, "-o", "json", "c"],
        ]),
      );
    });

    it("caps provider lookups at 4 at a time", async () => {
      const names = Array.from({ length: 10 }, (_, i) => ({
        name: `s${i}`,
        id: "i",
        phase: "Ready",
      }));
      let inFlight = 0;
      let peak = 0;
      const { exec } = fakeExec();
      (exec.run as jest.Mock).mockImplementation(async (_f: string, args: string[]) => {
        if (args[1] === "list") {
          return { code: 0, stdout: JSON.stringify({ sandboxes: names }), stderr: "" };
        }
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return { code: 0, stdout: JSON.stringify({ providers: [] }), stderr: "" };
      });
      const service = new OpenShellManagementService(
        mock<LogService>(),
        async () => detection(),
        fakeRegistry().registry,
        async () => true,
        exec,
        fakeFs(),
        enabled(),
      );
      const result = await service.listSandboxes();
      expect(result.ok).toBe(true);
      expect(peak).toBeLessThanOrEqual(4);
      expect(peak).toBeGreaterThan(1);
    });

    it("fails, not empty, on unparseable output", async () => {
      const { service } = create(() => ({ stdout: "not json" }));
      const result = await service.listSandboxes();
      expect(result.ok).toBe(false);
    });

    it("maps an unreachable gateway", async () => {
      const { service } = create(() => ({ code: 1, stderr: "connection refused" }));
      expect(await service.listSandboxes()).toEqual({
        ok: false,
        error: "gatewayUnreachable",
        message: "connection refused",
      });
    });
  });

  describe("sandboxAction", () => {
    it.each(["start", "stop", "delete"] as const)(
      "runs `sandbox %s <name>` as a mutation",
      async (action) => {
        const { service, calls } = create();
        expect(await service.sandboxAction({ action, name: "box" })).toEqual({
          ok: true,
          data: undefined,
        });
        expect(calls).toEqual([
          { file: CLI, args: ["sandbox", action, G, "box"], timeoutMs: 60_000 },
        ]);
      },
    );

    it("drops the registry entries of a deleted sandbox, but not of a stopped one", async () => {
      const stop = create(() => ({}), { registryContent: MANAGED });
      await stop.service.sandboxAction({ action: "stop", name: "box" });
      expect(await stop.registry.getForSandbox("work", "box")).toHaveLength(1);

      const del = create(() => ({}), { registryContent: MANAGED });
      await del.service.sandboxAction({ action: "delete", name: "box" });
      expect(await del.registry.getForSandbox("work", "box")).toHaveLength(0);
    });

    it("keeps the registry when the delete fails", async () => {
      const del = create(() => ({ code: 1, stderr: "nope" }), { registryContent: MANAGED });
      await del.service.sandboxAction({ action: "delete", name: "box" });
      expect(await del.registry.getForSandbox("work", "box")).toHaveLength(1);
    });

    const BAD_NAMES = [
      "",
      "-rf",
      "--all",
      "a b",
      "a;b",
      "$(x)",
      "`x`",
      "a|b",
      "a&b",
      "../x",
      "a\nb",
      "x".repeat(64),
    ];
    it.each(BAD_NAMES)("rejects the name %p without starting a process", async (name) => {
      const { service, calls } = create();
      expect(await service.sandboxAction({ action: "stop", name })).toEqual({
        ok: false,
        error: "invalidInput",
      });
      expect(calls).toHaveLength(0);
    });

    it("rejects an unknown action, a non-object and a non-string name", async () => {
      const { service, calls } = create();
      for (const request of [
        { action: "exec", name: "box" },
        { action: "stop", name: 5 },
        { action: "stop" },
        null,
        "stop",
        [],
      ]) {
        expect(await service.sandboxAction(request)).toEqual({ ok: false, error: "invalidInput" });
      }
      expect(calls).toHaveLength(0);
    });
  });

  describe("createSandbox", () => {
    it("passes exactly the requested fields, each provider as its own flag, and detaches", async () => {
      const { service, calls } = create(() => ({ stdout: JSON.stringify({ name: "made" }) }));
      const result = await service.createSandbox({
        name: "box",
        from: `ghcr.io/org/img:1.2@sha256:${"a".repeat(64)}`,
        cpu: "500m",
        memory: "4Gi",
        providerNames: ["github-box", "aws-box"],
      });
      expect(result).toEqual({ ok: true, data: { name: "made" } });
      expect(calls).toEqual([
        {
          file: CLI,
          args: [
            "sandbox",
            "create",
            G,
            "--name=box",
            `--from=ghcr.io/org/img:1.2@sha256:${"a".repeat(64)}`,
            "--cpu=500m",
            "--memory=4Gi",
            "--provider=github-box",
            "--provider=aws-box",
            "--detach",
            "-o",
            "json",
          ],
          timeoutMs: 60_000,
        },
      ]);
    });

    it("supports a template and an empty request", async () => {
      const t = create(() => ({ stdout: JSON.stringify({ sandbox: { name: "auto-1" } }) }));
      expect(await t.service.createSandbox({ template: "dev" })).toEqual({
        ok: true,
        data: { name: "auto-1" },
      });
      expect(t.calls[0].args).toEqual([
        "sandbox",
        "create",
        G,
        "--template=dev",
        "--detach",
        "-o",
        "json",
      ]);
    });

    it("never passes dangerous flags or a command", async () => {
      const { service, calls } = create();
      await service.createSandbox({
        name: "box",
        // Extra fields from a hostile renderer are ignored.
        ...({
          noKeep: true,
          editor: "vscode",
          gpu: 1,
          command: "sh",
          driverConfigJson: "{}",
        } as object),
      });
      const joined = calls[0].args.join(" ");
      for (const forbidden of [
        "--no-keep",
        "--editor",
        "--gpu",
        "--driver-config-json",
        " sh",
        "--",
      ]) {
        expect(
          joined.replace("--name", "").replace("--gateway", "").replace("--detach", ""),
        ).not.toContain(forbidden === "--" ? " -- " : forbidden);
      }
      expect(calls[0].args).not.toContain("--");
    });

    it("falls back to the requested name when the output has none, and fails when neither exists", async () => {
      const named = create(() => ({ stdout: "Created sandbox" }));
      expect(await named.service.createSandbox({ name: "box" })).toEqual({
        ok: true,
        data: { name: "box" },
      });
      const unnamed = create(() => ({ stdout: "Created sandbox" }));
      expect((await unnamed.service.createSandbox({})).ok).toBe(false);
    });

    it("ignores a created name from the gateway that is not a valid resource name", async () => {
      const { service } = create(() => ({ stdout: JSON.stringify({ name: "--evil" }) }));
      expect(await service.createSandbox({ name: "box" })).toEqual({
        ok: true,
        data: { name: "box" },
      });
    });

    it("rejects both from and template", async () => {
      const { service, calls } = create();
      expect(await service.createSandbox({ from: "img", template: "t" })).toEqual({
        ok: false,
        error: "invalidInput",
      });
      expect(calls).toHaveLength(0);
    });

    const BAD: [string, object][] = [
      ["name with leading dash", { name: "-x" }],
      ["name with space", { name: "a b" }],
      ["name with semicolon", { name: "a;b" }],
      ["name with subshell", { name: "$(x)" }],
      ["image with leading dash", { from: "-v" }],
      ["image with space", { from: "img tag" }],
      ["image path", { from: "/etc/passwd" }],
      ["image with injection", { from: "img;rm" }],
      ["template with leading dash", { template: "--x" }],
      ["template with injection", { template: "t;x" }],
      ["cpu with text", { cpu: "lots" }],
      ["cpu with flag", { cpu: "--1" }],
      ["memory with injection", { memory: "1G;x" }],
      ["memory unit", { memory: "1 GB" }],
      ["provider with leading dash", { providerNames: ["-x"] }],
      ["provider with whitespace", { providerNames: ["a b"] }],
      ["provider with injection", { providerNames: ["a;b"] }],
      ["provider with subshell", { providerNames: ["$(x)"] }],
      ["providers not an array", { providerNames: "a" }],
      ["too many providers", { providerNames: Array.from({ length: 17 }, (_, i) => `p${i}`) }],
      ["non-string provider", { providerNames: [5] }],
    ];
    it.each(BAD)("rejects %s without starting a process", async (_label, request) => {
      const { service, calls } = create();
      expect(await service.createSandbox(request)).toEqual({ ok: false, error: "invalidInput" });
      expect(calls).toHaveLength(0);
    });

    it("rejects a non-object request", async () => {
      const { service, calls } = create();
      for (const request of [null, undefined, "x", 3, []]) {
        expect(await service.createSandbox(request)).toEqual({ ok: false, error: "invalidInput" });
      }
      expect(calls).toHaveLength(0);
    });

    it("maps an existing name to alreadyExists", async () => {
      const { service } = create(() => ({ code: 1, stderr: "sandbox already exists" }));
      const result = await service.createSandbox({ name: "box" });
      expect(result.ok === false && result.error).toBe("alreadyExists");
    });
  });

  describe("listProfiles", () => {
    it("maps the real array shape and ignores unknown fields", async () => {
      const profiles = [
        {
          id: "github",
          display_name: "GitHub",
          description: "GH API",
          credentials: [
            {
              name: "api_token",
              description: "Token",
              env_vars: ["GH_TOKEN", "GITHUB_TOKEN", "bad name", "lower"],
              required: true,
              extra: 1,
            },
            { name: "optional", env_vars: ["X_Y"] },
            { description: "no name" },
          ],
          endpoints: [{ host: "api.github.com", port: 443, protocol: "rest" }, { host: "nope" }],
          binaries: ["/usr/bin/gh"],
        },
        { id: "-bad", display_name: "Bad" },
        { display_name: "No id" },
        "junk",
      ];
      const { service } = create(() => ({ stdout: JSON.stringify(profiles) }));
      expect(await service.listProfiles()).toEqual({
        ok: true,
        data: [
          {
            id: "github",
            displayName: "GitHub",
            description: "GH API",
            credentials: [
              {
                name: "api_token",
                description: "Token",
                envVars: ["GH_TOKEN", "GITHUB_TOKEN"],
                required: true,
              },
              { name: "optional", description: "", envVars: ["X_Y"], required: false },
            ],
            endpoints: [{ host: "api.github.com", port: 443 }],
            binaries: ["/usr/bin/gh"],
            editable: false,
          },
        ],
      });
    });

    it("keeps endpoint access and only string binaries, capped at 20", async () => {
      const { service } = create(() => ({
        stdout: JSON.stringify([
          {
            id: "p",
            display_name: "P",
            endpoints: [
              { host: "a.example", port: 443, access: "read-only" },
              { host: "b.example", port: 80, access: "" },
              { host: "c.example", port: 22, access: 5 },
            ],
            binaries: [
              "/usr/bin/curl",
              42,
              "",
              null,
              ...Array.from({ length: 30 }, (_v, i) => `/bin/b${i}`),
            ],
          },
          { id: "q", display_name: "Q", binaries: "nope" },
        ]),
      }));
      const result = await service.listProfiles();
      const [p, q] = result.ok ? result.data : [];
      expect(p.endpoints).toEqual([
        { host: "a.example", port: 443, access: "read-only" },
        { host: "b.example", port: 80 },
        { host: "c.example", port: 22 },
      ]);
      expect(p.binaries).toHaveLength(20);
      expect(p.binaries?.[0]).toBe("/usr/bin/curl");
      expect(p.binaries).not.toContain(42);
      expect(p.binaries).not.toContain("");
      expect(q.binaries).toEqual([]);
    });

    it("fails on unparseable output", async () => {
      const { service } = create(() => ({ stdout: "table output" }));
      expect((await service.listProfiles()).ok).toBe(false);
    });
  });

  describe("listCredentials", () => {
    it("merges the registry: managed with bindings, unmanaged without", async () => {
      const { service, calls } = create(
        () => ({
          stdout: JSON.stringify({
            providers: [
              "github-box",
              { name: "other", type: "aws", extra: true },
              { name: "p", profile: "x" },
            ],
          }),
        }),
        { registryContent: MANAGED },
      );
      const result = await service.listCredentials({ sandboxName: "box" });
      expect(calls[0].args).toEqual(["sandbox", "provider", "list", G, "-o", "json", "box"]);
      expect(result).toEqual({
        ok: true,
        data: [
          {
            providerName: "github-box",
            profileId: "github",
            managed: true,
            bindings: [
              {
                envVar: "GH_TOKEN",
                resourceType: "secret",
                id: SECRET_ID,
                field: "value",
                label: "GH",
              },
            ],
          },
          { providerName: "other", profileId: "aws", managed: false, bindings: [] },
          { providerName: "p", profileId: "x", managed: false, bindings: [] },
        ],
      });
    });

    it("accepts a bare array too, and an empty provider list", async () => {
      const arr = create(() => ({ stdout: JSON.stringify(["a"]) }));
      expect(await arr.service.listCredentials({ sandboxName: "box" })).toEqual({
        ok: true,
        data: [{ providerName: "a", profileId: null, managed: false, bindings: [] }],
      });
      const empty = create(() => ({ stdout: JSON.stringify({ providers: [] }) }));
      expect(await empty.service.listCredentials({ sandboxName: "box" })).toEqual({
        ok: true,
        data: [],
      });
    });

    it("fails, not empty, when the list is unparseable", async () => {
      for (const stdout of ["", "NAME TYPE", "{}", JSON.stringify({ providers: "x" })]) {
        const { service } = create(() => ({ stdout }));
        expect((await service.listCredentials({ sandboxName: "box" })).ok).toBe(false);
      }
    });

    it("rejects a bad sandbox name without a process", async () => {
      const { service, calls } = create();
      for (const sandboxName of ["-x", "a b", "a;b", "$(x)", "", 5]) {
        expect(await service.listCredentials({ sandboxName })).toEqual({
          ok: false,
          error: "invalidInput",
        });
      }
      expect(await service.listCredentials(undefined)).toEqual({
        ok: false,
        error: "invalidInput",
      });
      expect(calls).toHaveLength(0);
    });

    it("maps a missing sandbox", async () => {
      const { service } = create(() => ({ code: 1, stderr: "sandbox not found" }));
      const result = await service.listCredentials({ sandboxName: "box" });
      expect(result.ok === false && result.error).toBe("notFound");
    });
  });

  describe("addCredential", () => {
    const binding = {
      envVar: "GH_TOKEN",
      resourceType: "item",
      id: ITEM_ID,
      field: "password",
      label: "  My GitHub\u0007 login  ",
    };

    it("creates the provider with one --credential per binding, attaches it and records it", async () => {
      const { service, calls, registry } = create();
      const result = await service.addCredential({
        sandboxName: "box",
        profileId: "github",
        bindings: [
          binding,
          { ...binding, envVar: "GH_USER", field: "username" },
          {
            envVar: "OTHER",
            resourceType: "secret",
            id: SECRET_ID,
            field: "value",
            label: "S",
          },
        ],
      });
      expect(result).toEqual({ ok: true, data: undefined });
      expect(calls).toEqual([
        {
          file: CLI,
          args: ["provider", "list-profiles", G, "-o", "json"],
          timeoutMs: 15_000,
        },
        {
          file: CLI,
          args: [
            "provider",
            "create",
            G,
            "--name=github-box",
            "--type=github",
            `--credential=GH_TOKEN=bw://item/${ITEM_ID}#password`,
            `--credential=GH_USER=bw://item/${ITEM_ID}#username`,
            `--credential=OTHER=bw://secret/${SECRET_ID}`,
          ],
          timeoutMs: 60_000,
        },
        {
          file: CLI,
          args: ["sandbox", "provider", "attach", G, "box", "github-box"],
          timeoutMs: 60_000,
        },
      ]);
      const [entry] = await registry.getForSandbox("work", "box");
      expect(entry.providerName).toBe("github-box");
      expect(entry.profileId).toBe("github");
      expect(entry.bindings[0]).toEqual({
        envVar: "GH_TOKEN",
        resourceType: "item",
        id: ITEM_ID,
        field: "password",
        label: "My GitHub login",
      });
    });

    it("never persists a bw:// reference", async () => {
      const { service, state } = create();
      await service.addCredential({ sandboxName: "box", profileId: "github", bindings: [binding] });
      expect(state.content).not.toContain("bw://");
    });

    it("uses a given provider name and truncates a derived one to the name limit", async () => {
      const named = create();
      await named.service.addCredential({
        sandboxName: "box",
        profileId: "github",
        providerName: "mine",
        bindings: [binding],
      });
      expect(named.calls[1].args).toContain("--name=mine");

      const long = create();
      const sandboxName = "s".repeat(60);
      await long.service.addCredential({ sandboxName, profileId: "github", bindings: [binding] });
      const nameArg = long.calls[1].args.find((a) => a.startsWith("--name="))!;
      expect(nameArg.length - "--name=".length).toBe(63);
      expect(nameArg).toBe(`--name=${`github-${sandboxName}`.slice(0, 63)}`);
    });

    it("truncates a label to 120 characters and strips control characters", async () => {
      const { service, registry } = create();
      await service.addCredential({
        sandboxName: "box",
        profileId: "github",
        bindings: [{ ...binding, label: `a\u0000b\n${"x".repeat(200)}` }],
      });
      const label = (await registry.getForSandbox("work", "box"))[0].bindings[0].label;
      expect(label.length).toBe(120);
      expect(label.startsWith("abxxx")).toBe(true);
    });

    it("rolls the provider back when attach fails, and reports failed without recording", async () => {
      const { service, calls, registry, log } = create((args) =>
        args[0] === "sandbox"
          ? { code: 1, stderr: `attach failed bw://item/${ITEM_ID}#password` }
          : {},
      );
      const result = await service.addCredential({
        sandboxName: "box",
        profileId: "github",
        bindings: [binding],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("failed");
        expect(result.message).not.toContain("bw://");
      }
      expect(calls.map((c) => c.args.slice(0, 3))).toEqual([
        ["provider", "list-profiles", G],
        ["provider", "create", G],
        ["sandbox", "provider", "attach"],
        ["provider", "delete", G],
      ]);
      expect(calls[3].args).toEqual(["provider", "delete", G, "github-box"]);
      expect(await registry.getForSandbox("work", "box")).toEqual([]);
      expect(log.warning).toHaveBeenCalled();
    });

    it("still reports failed (and logs) if the rollback itself fails", async () => {
      const { service, log } = create((args) =>
        args[0] === "provider" && args[1] === "create" ? {} : { code: 1, stderr: "x" },
      );
      const result = await service.addCredential({
        sandboxName: "box",
        profileId: "github",
        bindings: [binding],
      });
      expect(result.ok === false && result.error).toBe("failed");
      expect(log.warning).toHaveBeenCalled();
    });

    it("maps a taken provider name to alreadyExists and does not attach", async () => {
      const { service, calls } = create(() => ({ code: 1, stderr: "provider already exists" }));
      const result = await service.addCredential({
        sandboxName: "box",
        profileId: "github",
        bindings: [binding],
      });
      expect(result.ok === false && result.error).toBe("alreadyExists");
      expect(calls).toHaveLength(1);
    });

    it("maps an unknown profile to notFound", async () => {
      const { service } = create(() => ({ code: 1, stderr: "profile 'x' not found" }));
      const result = await service.addCredential({
        sandboxName: "box",
        profileId: "x",
        bindings: [binding],
      });
      expect(result.ok === false && result.error).toBe("notFound");
    });

    it("still succeeds when the registry cannot be written, and logs it", async () => {
      const { service, adapter, log } = create();
      (adapter.writeAtomic as jest.Mock).mockRejectedValue(new Error("disk"));
      const result = await service.addCredential({
        sandboxName: "box",
        profileId: "github",
        bindings: [binding],
      });
      expect(result.ok).toBe(true);
      expect(log.warning).toHaveBeenCalled();
    });

    const base = { sandboxName: "box", profileId: "github", bindings: [binding] };
    const BAD: [string, unknown][] = [
      ["sandbox with leading dash", { ...base, sandboxName: "-x" }],
      ["sandbox with injection", { ...base, sandboxName: "a;b" }],
      ["profile with leading dash", { ...base, profileId: "--type" }],
      ["profile with space", { ...base, profileId: "a b" }],
      ["profile with subshell", { ...base, profileId: "$(x)" }],
      ["provider with leading dash", { ...base, providerName: "-x" }],
      ["provider with whitespace", { ...base, providerName: "a b" }],
      ["provider with injection", { ...base, providerName: "a;b" }],
      ["no bindings", { ...base, bindings: [] }],
      ["bindings not an array", { ...base, bindings: binding }],
      [
        "too many bindings",
        {
          ...base,
          bindings: Array.from({ length: 17 }, (_, i) => ({ ...binding, envVar: `V${i}` })),
        },
      ],
      ["binding not an object", { ...base, bindings: ["x"] }],
      ["lowercase env var", { ...base, bindings: [{ ...binding, envVar: "gh_token" }] }],
      ["env var with equals", { ...base, bindings: [{ ...binding, envVar: "A=B" }] }],
      ["env var with leading dash", { ...base, bindings: [{ ...binding, envVar: "-A" }] }],
      ["env var with space", { ...base, bindings: [{ ...binding, envVar: "A B" }] }],
      ["env var with subshell", { ...base, bindings: [{ ...binding, envVar: "$(x)" }] }],
      ["uppercase uuid", { ...base, bindings: [{ ...binding, id: ITEM_ID.toUpperCase() }] }],
      ["non-uuid id", { ...base, bindings: [{ ...binding, id: "abc" }] }],
      ["id with fragment", { ...base, bindings: [{ ...binding, id: `${ITEM_ID}#password` }] }],
      ["unknown resource type", { ...base, bindings: [{ ...binding, resourceType: "folder" }] }],
      [
        "secret with password field",
        { ...base, bindings: [{ ...binding, resourceType: "secret", field: "password" }] },
      ],
      ["item with value field", { ...base, bindings: [{ ...binding, field: "value" }] }],
      ["non-string label", { ...base, bindings: [{ ...binding, label: 5 }] }],
      ["duplicate env var", { ...base, bindings: [binding, binding] }],
    ];
    it.each(BAD)("rejects %s without starting a process", async (_label, request) => {
      const { service, calls } = create();
      expect(await service.addCredential(request)).toEqual({ ok: false, error: "invalidInput" });
      expect(calls).toHaveLength(0);
    });

    it("rejects a non-object request", async () => {
      const { service, calls } = create();
      for (const request of [undefined, null, "x", []]) {
        expect(await service.addCredential(request)).toEqual({ ok: false, error: "invalidInput" });
      }
      expect(calls).toHaveLength(0);
    });
  });

  describe("removeCredential", () => {
    it("detaches only, for an unmanaged provider", async () => {
      const { service, calls } = create();
      const result = await service.removeCredential({
        sandboxName: "box",
        providerName: "foreign",
        deleteProvider: false,
      });
      expect(result).toEqual({ ok: true, data: undefined });
      expect(calls).toEqual([
        {
          file: CLI,
          args: ["sandbox", "provider", "detach", G, "box", "foreign"],
          timeoutMs: 60_000,
        },
      ]);
    });

    it("never deletes an unmanaged provider: invalidInput and no process", async () => {
      const { service, calls } = create();
      const result = await service.removeCredential({
        sandboxName: "box",
        providerName: "foreign",
        deleteProvider: true,
      });
      expect(result).toEqual({ ok: false, error: "invalidInput" });
      expect(calls).toHaveLength(0);
    });

    it("does not treat a provider managed for another sandbox as managed", async () => {
      const { service, calls } = create(() => ({}), { registryContent: MANAGED });
      const result = await service.removeCredential({
        sandboxName: "other",
        providerName: "github-box",
        deleteProvider: true,
      });
      expect(result).toEqual({ ok: false, error: "invalidInput" });
      expect(calls).toHaveLength(0);
    });

    it("detaches then deletes a managed provider and removes its record", async () => {
      const { service, calls, registry } = create(() => ({}), { registryContent: MANAGED });
      const result = await service.removeCredential({
        sandboxName: "box",
        providerName: "github-box",
        deleteProvider: true,
      });
      expect(result).toEqual({ ok: true, data: undefined });
      expect(calls.map((c) => c.args)).toEqual([
        ["sandbox", "provider", "detach", G, "box", "github-box"],
        ["sandbox", "list", G, "-o", "json"],
        ["provider", "delete", G, "github-box"],
      ]);
      expect(await registry.getForSandbox("work", "box")).toEqual([]);
    });

    it("detaches a managed provider without deleting it when deleteProvider is false, dropping the record", async () => {
      const { service, calls, registry } = create(() => ({}), { registryContent: MANAGED });
      await service.removeCredential({
        sandboxName: "box",
        providerName: "github-box",
        deleteProvider: false,
      });
      expect(calls).toHaveLength(1);
      expect(await registry.getForSandbox("work", "box")).toEqual([]);
    });

    it("keeps the record and reports the error when the detach fails", async () => {
      const { service, calls, registry } = create(
        () => ({ code: 1, stderr: "provider not found" }),
        {
          registryContent: MANAGED,
        },
      );
      const result = await service.removeCredential({
        sandboxName: "box",
        providerName: "github-box",
        deleteProvider: true,
      });
      expect(result.ok === false && result.error).toBe("notFound");
      expect(calls).toHaveLength(1);
      expect(await registry.getForSandbox("work", "box")).toHaveLength(1);
    });

    it("keeps the record when the provider delete fails after a successful detach", async () => {
      const { service, registry } = create(
        (args) =>
          args[0] === "provider" && args[1] === "delete" ? { code: 1, stderr: "denied" } : {},
        { registryContent: MANAGED },
      );
      const result = await service.removeCredential({
        sandboxName: "box",
        providerName: "github-box",
        deleteProvider: true,
      });
      expect(result.ok === false && result.error).toBe("failed");
      expect(await registry.getForSandbox("work", "box")).toHaveLength(1);
    });

    const BAD: [string, unknown][] = [
      [
        "sandbox with leading dash",
        { sandboxName: "-x", providerName: "p", deleteProvider: false },
      ],
      [
        "provider with leading dash",
        { sandboxName: "b", providerName: "-p", deleteProvider: false },
      ],
      [
        "provider with whitespace",
        { sandboxName: "b", providerName: "a b", deleteProvider: false },
      ],
      ["provider with injection", { sandboxName: "b", providerName: "a;b", deleteProvider: false }],
      ["provider with subshell", { sandboxName: "b", providerName: "$(x)", deleteProvider: false }],
      ["missing deleteProvider", { sandboxName: "b", providerName: "p" }],
      ["string deleteProvider", { sandboxName: "b", providerName: "p", deleteProvider: "true" }],
      ["no request", undefined],
    ];
    it.each(BAD)("rejects %s without starting a process", async (_label, request) => {
      const { service, calls } = create();
      expect(await service.removeCredential(request)).toEqual({ ok: false, error: "invalidInput" });
      expect(calls).toHaveLength(0);
    });
  });

  describe("permission profiles", () => {
    const EXPORTED = {
      id: "bw-api",
      resource_version: 7,
      display_name: "API",
      description: "old",
      category: "other",
      credentials: [{ name: "api_token", env_vars: ["API_TOKEN"], required: true }],
      endpoints: [
        {
          host: "api.example.com",
          port: 443,
          protocol: "websocket",
          access: "read-only",
          enforcement: "audit",
          tls: "skip",
        },
      ],
      binaries: ["/usr/bin/curl"],
      inference_capable: false,
      source: "user",
      scope: "platform",
    };

    interface Written {
      content: string;
      removed: boolean;
    }

    function harness(
      options: {
        exported?: unknown;
        handler?: Handler;
        listed?: unknown;
        enabledState?: OpenShellEnabledState;
        writeFails?: boolean;
      } = {},
    ) {
      const written: Written[] = [];
      const files: Record<string, string> = {};
      const fsAdapter: OpenShellManagementFs = {
        stat: jest.fn(async () => ({ mode: 0o100755 })),
        writeTempFile: jest.fn(async (content: string) => {
          if (options.writeFails) {
            throw new Error("disk full");
          }
          const filePath = `/tmp/bitwarden-openshell-x/profile-${written.length}.json`;
          const entry = { content, removed: false };
          written.push(entry);
          files[filePath] = content;
          return {
            filePath,
            remove: async () => {
              entry.removed = true;
            },
          };
        }),
      };
      const { exec, calls } = fakeExec((args) => {
        const custom = options.handler?.(args);
        if (custom != null && Object.keys(custom).length > 0) {
          return custom;
        }
        if (args[0] === "provider" && args[1] === "profile" && args[2] === "export") {
          return { stdout: JSON.stringify(options.exported ?? EXPORTED) };
        }
        if (args[0] === "provider" && args[1] === "list-profiles") {
          return { stdout: JSON.stringify(options.listed ?? []) };
        }
        return {};
      });
      const { registry } = fakeRegistry();
      const service = new OpenShellManagementService(
        mock<LogService>(),
        async () => detection(),
        registry,
        async () => true,
        exec,
        fsAdapter,
        options.enabledState ?? enabled(),
      );
      return { service, calls, written, fsAdapter };
    }

    const updateRequest = {
      id: "bw-api",
      displayName: "API v2",
      description: "new",
      endpoints: [
        { host: "api.example.com", port: 443, access: "read-write" },
        { host: "Files.Example.com", port: 8443, access: "read-only" },
      ],
      binaries: ["/usr/bin/curl", "/usr/bin/curl", "/usr/local/bin/gh"],
    };

    const createRequest = {
      id: "bw-new",
      displayName: "New API",
      description: "d",
      credentialEnvVar: "NEW_TOKEN",
      endpoints: [{ host: "api.new.com", port: 443, access: "read-only" }],
      binaries: ["/usr/bin/curl"],
    };

    describe("updateProfile", () => {
      it("exports, merges only the editable parts, then updates without linting (lint refuses an existing id)", async () => {
        const { service, calls, written } = harness();

        expect(await service.updateProfile(updateRequest)).toEqual({ ok: true, data: undefined });

        expect(calls.map((c) => c.args.slice(0, 3))).toEqual([
          ["provider", "profile", "export"],
          ["provider", "profile", "update"],
        ]);
        expect(calls[0].args).toEqual(["provider", "profile", "export", G, "-o", "json", "bw-api"]);
        const file = written[0];
        const updateFile = calls[1].args.find((a) => a.startsWith("--file="));
        expect(calls[1].args).toEqual([
          "provider",
          "profile",
          "update",
          G,
          updateFile,
          "--global",
          "bw-api",
        ]);
        const merged = JSON.parse(file.content);
        expect(merged).toMatchObject({
          id: "bw-api",
          resource_version: 7,
          display_name: "API v2",
          description: "new",
          category: "other",
          source: "user",
          scope: "platform",
          inference_capable: false,
          credentials: EXPORTED.credentials,
          binaries: ["/usr/bin/curl", "/usr/local/bin/gh"],
        });
        expect(merged.endpoints).toEqual([
          { ...EXPORTED.endpoints[0], access: "read-write" },
          {
            host: "files.example.com",
            port: 8443,
            protocol: "rest",
            access: "read-only",
            enforcement: "enforce",
          },
        ]);
        expect(file.removed).toBe(true);
      });

      it("leaves out --global for a profile that is not platform-scoped", async () => {
        const { service, calls } = harness({ exported: { ...EXPORTED, scope: "workspace" } });

        await service.updateProfile(updateRequest);

        expect(calls.every((c) => !c.args.includes("--global"))).toBe(true);
      });

      it("refuses a built-in profile before writing anything", async () => {
        const { service, calls, written } = harness({
          exported: { ...EXPORTED, source: "builtin" },
        });

        const result = await service.updateProfile(updateRequest);

        expect(result).toMatchObject({ ok: false, error: "unsupported" });
        expect(result.message).toContain("Built-in");
        expect(written).toEqual([]);
        expect(calls).toHaveLength(1);
      });

      it("refuses an export for a different id", async () => {
        const { service, written } = harness({ exported: { ...EXPORTED, id: "other" } });

        expect(await service.updateProfile(updateRequest)).toMatchObject({
          ok: false,
          error: "failed",
        });
        expect(written).toEqual([]);
      });

      it("removes the temp file even when the update fails, and scrubs the message", async () => {
        const { service, written } = harness({
          handler: (args) =>
            args[2] === "update"
              ? { code: 1, stderr: "denied for bw://item/0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33" }
              : {},
        });

        const result = await service.updateProfile(updateRequest);

        expect(result).toMatchObject({ ok: false, error: "failed" });
        expect(result.message).not.toContain("bw://");
        expect(written[0].removed).toBe(true);
      });

      it("fails cleanly when the temp file can't be written", async () => {
        const { service, calls } = harness({ writeFails: true });

        expect(await service.updateProfile(updateRequest)).toMatchObject({
          ok: false,
          error: "failed",
        });
        expect(calls).toHaveLength(1);
      });

      it("strips hidden characters from the name and description", async () => {
        const { service, written } = harness();

        await service.updateProfile({
          ...updateRequest,
          displayName: "A\u202Epi\u0000 v2",
          description: "x\u200Fy",
        });

        const merged = JSON.parse(written[0].content);
        expect(merged.display_name).toBe("Api v2");
        expect(merged.description).toBe("xy");
      });

      it.each([
        ["no id", { ...updateRequest, id: undefined }],
        ["flag-like id", { ...updateRequest, id: "-x" }],
        ["empty name", { ...updateRequest, displayName: "\u200B  " }],
        ["no endpoints", { ...updateRequest, endpoints: [] }],
        [
          "bare wildcard host",
          { ...updateRequest, endpoints: [{ host: "*", port: 1, access: "read-only" }] },
        ],
        [
          "url as host",
          {
            ...updateRequest,
            endpoints: [{ host: "https://x.com", port: 443, access: "read-only" }],
          },
        ],
        [
          "port 0",
          { ...updateRequest, endpoints: [{ host: "x.com", port: 0, access: "read-only" }] },
        ],
        [
          "unknown access",
          { ...updateRequest, endpoints: [{ host: "x.com", port: 443, access: "write" }] },
        ],
        [
          "conflicting duplicate",
          {
            ...updateRequest,
            endpoints: [
              { host: "x.com", port: 443, access: "read-only" },
              { host: "X.com", port: 443, access: "read-write" },
            ],
          },
        ],
        ["relative program", { ...updateRequest, binaries: ["curl"] }],
        ["program with ..", { ...updateRequest, binaries: ["/usr/../bin/curl"] }],
        ["program with a space", { ...updateRequest, binaries: ["/usr/bin/c url"] }],
        [
          "too many programs",
          { ...updateRequest, binaries: Array.from({ length: 21 }, (_, i) => `/bin/p${i}`) },
        ],
        ["not an object", "x"],
      ])("rejects %s before any process starts", async (_name, request) => {
        const { service, calls } = harness();

        expect(await service.updateProfile(request)).toEqual({
          ok: false,
          error: "invalidInput",
        });
        expect(calls).toEqual([]);
      });

      it("refuses while OpenShell is switched off", async () => {
        const { service, calls } = harness({ enabledState: enabled(false) });

        expect(await service.updateProfile(updateRequest)).toMatchObject({
          ok: false,
          error: "unsupported",
        });
        expect(calls).toEqual([]);
      });
    });

    describe("createProfile", () => {
      it("builds a bearer-token profile, lints it, then imports it", async () => {
        const { service, calls, written } = harness();

        expect(await service.createProfile(createRequest)).toEqual({ ok: true, data: undefined });

        expect(calls.map((c) => c.args.slice(0, 3))).toEqual([
          ["provider", "list-profiles", G],
          ["provider", "profile", "lint"],
          ["provider", "profile", "import"],
        ]);
        const lintFile = calls[1].args.find((a) => a.startsWith("--file="));
        expect(calls[2].args).toEqual(["provider", "profile", "import", G, lintFile, "--global"]);
        expect(JSON.parse(written[0].content)).toEqual({
          id: "bw-new",
          display_name: "New API",
          description: "d",
          category: "other",
          credentials: [
            {
              name: "api_token",
              description: "",
              env_vars: ["NEW_TOKEN"],
              required: true,
              auth_style: "bearer",
              header_name: "authorization",
              query_param: "",
            },
          ],
          endpoints: [
            {
              host: "api.new.com",
              port: 443,
              protocol: "rest",
              access: "read-only",
              enforcement: "enforce",
            },
          ],
          binaries: ["/usr/bin/curl"],
          inference_capable: false,
        });
        expect(written[0].removed).toBe(true);
      });

      it("won't replace an id that already exists", async () => {
        const { service, calls, written } = harness({
          listed: [{ id: "bw-new", display_name: "x" }],
        });

        expect(await service.createProfile(createRequest)).toEqual({
          ok: false,
          error: "alreadyExists",
        });
        expect(written).toEqual([]);
        expect(calls).toHaveLength(1);
      });

      it("maps an 'already exists' failure from import", async () => {
        const { service } = harness({
          handler: (args) =>
            args[2] === "import" ? { code: 1, stderr: "profile already exists" } : {},
        });

        expect(await service.createProfile(createRequest)).toMatchObject({
          ok: false,
          error: "alreadyExists",
        });
      });

      it.each([
        ["denied env var", { ...createRequest, credentialEnvVar: "LD_PRELOAD" }],
        ["bad env var", { ...createRequest, credentialEnvVar: "lower" }],
        ["no endpoint", { ...createRequest, endpoints: [] }],
        ["bad id", { ...createRequest, id: "../x" }],
        ["empty name", { ...createRequest, displayName: "" }],
        ["non-string description", { ...createRequest, description: 1 }],
        ["bad program", { ...createRequest, binaries: ["relative"] }],
      ])("rejects %s before any process starts", async (_name, request) => {
        const { service, calls } = harness();

        expect(await service.createProfile(request)).toEqual({ ok: false, error: "invalidInput" });
        expect(calls).toEqual([]);
      });

      it("drops extra fields on an endpoint instead of writing them", async () => {
        const { service, written } = harness();

        await service.createProfile({
          ...createRequest,
          endpoints: [
            { host: "api.new.com", port: 443, access: "read-only", enforcement: "audit", tls: 1 },
          ],
        });

        expect(JSON.parse(written[0].content).endpoints[0].enforcement).toBe("enforce");
        expect(JSON.parse(written[0].content).endpoints[0]).not.toHaveProperty("tls");
      });
    });

    describe("deleteProfile", () => {
      it("exports to check it is custom, then deletes with --global for a platform profile", async () => {
        const { service, calls } = harness();

        expect(await service.deleteProfile({ id: "bw-api" })).toEqual({
          ok: true,
          data: undefined,
        });

        expect(calls.map((c) => c.args)).toEqual([
          ["provider", "profile", "export", G, "-o", "json", "bw-api"],
          ["provider", "profile", "delete", G, "--global", "bw-api"],
        ]);
      });

      it("refuses a built-in profile", async () => {
        const { service, calls } = harness({ exported: { ...EXPORTED, source: "builtin" } });

        expect(await service.deleteProfile({ id: "bw-api" })).toMatchObject({
          ok: false,
          error: "unsupported",
        });
        expect(calls).toHaveLength(1);
      });

      it("passes the gateway's refusal on, scrubbed", async () => {
        const { service } = harness({
          handler: (args) => (args[2] === "delete" ? { code: 1, stderr: "profile is in use" } : {}),
        });

        expect(await service.deleteProfile({ id: "bw-api" })).toEqual({
          ok: false,
          error: "failed",
          message: "profile is in use",
        });
      });

      it.each([[{ id: "-rf" }], [{}], [null], [{ id: "a b" }]])(
        "rejects %j before any process starts",
        async (request) => {
          const { service, calls } = harness();

          expect(await service.deleteProfile(request)).toEqual({
            ok: false,
            error: "invalidInput",
          });
          expect(calls).toEqual([]);
        },
      );
    });

    describe("listProfiles editable flag", () => {
      it("marks only source: user profiles as editable", async () => {
        const { service } = create(() => ({
          stdout: JSON.stringify([
            { id: "mine", display_name: "Mine", source: "user" },
            { id: "theirs", display_name: "Theirs", source: "builtin" },
            { id: "unknown", display_name: "Unknown" },
          ]),
        }));

        const result = await service.listProfiles();

        expect(result.data?.map((p) => [p.id, p.editable])).toEqual([
          ["mine", true],
          ["theirs", false],
          ["unknown", false],
        ]);
      });
    });
  });

  describe("getApplyStatus", () => {
    const list = JSON.stringify({ providers: ["p1", { name: "p2" }] });

    it("asks for each attached provider and aggregates", async () => {
      const { service, calls } = create((args) =>
        args[2] === "list"
          ? { stdout: list }
          : { stdout: JSON.stringify({ applied: true, message: "ok" }) },
      );
      expect(await service.getApplyStatus({ sandboxName: "box" })).toEqual({
        ok: true,
        data: { applied: true, detail: "ok; ok" },
      });
      expect(calls.map((c) => c.args)).toEqual([
        ["sandbox", "provider", "list", G, "-o", "json", "box"],
        ["sandbox", "provider", "status", G, "-o", "json", "box", "p1"],
        ["sandbox", "provider", "status", G, "-o", "json", "box", "p2"],
      ]);
    });

    it("is not applied when any provider is not applied", async () => {
      const { service } = create((args) =>
        args[2] === "list"
          ? { stdout: list }
          : args[args.length - 1] === "p2"
            ? { stdout: "Status: pending" }
            : { stdout: "applied" },
      );
      const result = await service.getApplyStatus({ sandboxName: "box" });
      expect(result.ok && result.data.applied).toBe(false);
    });

    it("understands text output, and 'not applied' is not applied", async () => {
      const yes = create((args) =>
        args[2] === "list" ? { stdout: list } : { stdout: "Change applied\n" },
      );
      expect(await yes.service.getApplyStatus({ sandboxName: "box" })).toEqual({
        ok: true,
        data: { applied: true, detail: "Change applied; Change applied" },
      });
      const no = create((args) =>
        args[2] === "list" ? { stdout: list } : { stdout: "not applied yet" },
      );
      const result = await no.service.getApplyStatus({ sandboxName: "box" });
      expect(result.ok && result.data.applied).toBe(false);
    });

    it("truncates the detail to 200 characters and removes bw:// references", async () => {
      const { service } = create((args) =>
        args[2] === "list"
          ? { stdout: JSON.stringify({ providers: ["p1"] }) }
          : { stdout: `applied bw://secret/${SECRET_ID} ${"y ".repeat(300)}` },
      );
      const result = await service.getApplyStatus({ sandboxName: "box" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detail.length).toBeLessThanOrEqual(200);
        expect(result.data.detail).not.toContain("bw://");
      }
    });

    it("is applied with no detail when nothing is attached", async () => {
      const { service, calls } = create(() => ({ stdout: JSON.stringify({ providers: [] }) }));
      expect(await service.getApplyStatus({ sandboxName: "box" })).toEqual({
        ok: true,
        data: { applied: true, detail: "" },
      });
      expect(calls).toHaveLength(1);
    });

    it("surfaces a CLI failure", async () => {
      const { service } = create((args) =>
        args[2] === "list" ? { stdout: list } : { code: 1, stderr: "connection refused" },
      );
      const result = await service.getApplyStatus({ sandboxName: "box" });
      expect(result.ok === false && result.error).toBe("gatewayUnreachable");
    });

    it("rejects a bad sandbox name without a process", async () => {
      const { service, calls } = create();
      for (const sandboxName of ["-x", "a b", "a;b", "$(x)"]) {
        expect(await service.getApplyStatus({ sandboxName })).toEqual({
          ok: false,
          error: "invalidInput",
        });
      }
      expect(calls).toHaveLength(0);
    });
  });

  describe("security hardening", () => {
    const ADD = {
      sandboxName: "box",
      profileId: "github",
      bindings: [
        {
          envVar: "GH_TOKEN",
          resourceType: "item",
          id: ITEM_ID,
          field: "password",
          label: "x",
        },
      ],
    };
    const REMOVE = { sandboxName: "box", providerName: "github-box", deleteProvider: true };

    describe("toggle gate", () => {
      it("is unsupported, with no process, while the Agent Access OpenShell toggle is off", async () => {
        const { service, calls } = create(() => ({}), { enabledState: enabled(false) });
        expect(await service.listSandboxes()).toEqual({ ok: false, error: "unsupported" });
        expect(await service.addCredential(ADD)).toEqual({ ok: false, error: "unsupported" });
        expect(calls).toHaveLength(0);
      });

      it("follows the shared state as it changes", async () => {
        const state = enabled(false);
        const { service } = create(() => ({ stdout: "[]" }), { enabledState: state });
        expect((await service.listProfiles()).ok).toBe(false);
        state.set(true);
        expect((await service.listProfiles()).ok).toBe(true);
        state.set(false);
        expect((await service.listProfiles()).ok).toBe(false);
      });
    });

    describe("binary location", () => {
      it.each([
        ["the binary is group-writable", { [CLI]: 0o100775 }],
        ["the binary is world-writable", { [CLI]: 0o100757 }],
        ["its directory is world-writable", { "/opt/homebrew/bin": 0o40777 }],
      ])("refuses to run it when %s", async (_name, modes) => {
        const { service, calls } = create(() => ({ stdout: "[]" }), { modes });
        expect(await service.listProfiles()).toEqual({
          ok: false,
          error: "failed",
          message: "The openshell binary location is writable by other users.",
        });
        expect(calls).toHaveLength(0);
      });

      it("still runs it when its directory is group-writable, as Homebrew's is", async () => {
        const { service, calls } = create(() => ({ stdout: "[]" }), {
          modes: { "/opt/homebrew/bin": 0o40775 },
        });

        expect((await service.listProfiles()).ok).toBe(true);
        expect(calls).toHaveLength(1);
      });

      it("runs it when neither is writable by others", async () => {
        const { service, calls } = create(() => ({ stdout: "[]" }), {
          modes: { [CLI]: 0o100755, "/opt/homebrew/bin": 0o40755 },
        });
        expect((await service.listProfiles()).ok).toBe(true);
        expect(calls).toHaveLength(1);
      });
    });

    describe("timeouts", () => {
      it.each([
        ["start", () => ({ action: "start", name: "box" })],
        ["delete", () => ({ action: "delete", name: "box" })],
      ])("maps a timed-out %s to failed, not gatewayUnreachable", async (_n, request) => {
        const { service } = create(() => ({ code: 1, stderr: "timed out", timedOut: true }));
        expect(await service.sandboxAction(request())).toEqual({
          ok: false,
          error: "failed",
          message: "The command timed out; check the sandbox's state before retrying.",
        });
      });

      it("maps a timed-out create, attach and provider create to failed", async () => {
        const timedOut = { code: 1, stderr: "timed out", timedOut: true };
        const created = create(() => timedOut);
        expect(await created.service.createSandbox({ name: "box" })).toMatchObject({
          ok: false,
          error: "failed",
        });
        const add = create((args) => (args[1] === "list-profiles" ? {} : timedOut));
        expect(await add.service.addCredential(ADD)).toMatchObject({
          ok: false,
          error: "failed",
          message: "The command timed out; check the sandbox's state before retrying.",
        });
      });

      it("keeps a timed-out read as gatewayUnreachable", async () => {
        const { service } = create(() => ({ code: 1, stderr: "timed out", timedOut: true }));
        expect(await service.listProfiles()).toMatchObject({
          ok: false,
          error: "gatewayUnreachable",
        });
      });
    });

    describe("gateway-reported strings", () => {
      it("truncates sandbox fields", async () => {
        const { service } = create((args) =>
          args[1] === "list"
            ? {
                stdout: JSON.stringify([
                  {
                    name: "n".repeat(100),
                    id: "i".repeat(300),
                    phase: "p".repeat(300),
                    created_at: "c".repeat(300),
                  },
                ]),
              }
            : { stdout: "[]" },
        );
        const result = await service.listSandboxes();
        const sandbox = result.ok ? result.data[0] : null;
        expect(sandbox?.name).toHaveLength(64);
        expect(sandbox?.id).toHaveLength(128);
        expect(sandbox?.phase).toHaveLength(64);
        expect(sandbox?.createdAt).toHaveLength(64);
      });

      it("truncates profile text and hosts", async () => {
        const { service } = create(() => ({
          stdout: JSON.stringify([
            {
              id: "p",
              display_name: "d".repeat(500),
              description: "e".repeat(900),
              credentials: [{ name: "c", description: "f".repeat(900), env_vars: ["A"] }],
              endpoints: [{ host: "h".repeat(600), port: 443 }],
            },
          ]),
        }));
        const result = await service.listProfiles();
        const profile = result.ok ? result.data[0] : null;
        expect(profile?.displayName).toHaveLength(120);
        expect(profile?.description).toHaveLength(300);
        expect(profile?.credentials[0].description).toHaveLength(300);
        expect(profile?.endpoints[0].host).toHaveLength(255);
      });

      it("truncates endpoint access and binary paths", async () => {
        const { service } = create(() => ({
          stdout: JSON.stringify([
            {
              id: "p",
              display_name: "d",
              endpoints: [{ host: "h", port: 443, access: "a".repeat(500) }],
              binaries: ["/".concat("b".repeat(600))],
            },
          ]),
        }));
        const result = await service.listProfiles();
        const profile = result.ok ? result.data[0] : null;
        expect(profile?.endpoints[0].access).toHaveLength(120);
        expect(profile?.binaries?.[0]).toHaveLength(255);
      });

      it("counts providers for at most the first 50 sandboxes", async () => {
        const names = Array.from({ length: 60 }, (_v, i) => ({ name: `sb${i}` }));
        const { service, calls } = create((args) =>
          args[1] === "list"
            ? { stdout: JSON.stringify(names) }
            : { stdout: JSON.stringify(["p"]) },
        );
        const result = await service.listSandboxes();
        expect(calls.filter((c) => c.args[1] === "provider" && c.args[2] === "list")).toHaveLength(
          50,
        );
        const data = result.ok ? result.data : [];
        expect(data[49].providerCount).toBe(1);
        expect(data[50].providerCount).toBeNull();
        expect(data[59].providerCount).toBeNull();
      });
    });

    describe("addCredential env vars and profiles", () => {
      const withEnv = (envVar: string) => ({
        ...ADD,
        bindings: [{ ...ADD.bindings[0], envVar }],
      });

      it.each([
        "LD_PRELOAD",
        "LD_LIBRARY_PATH",
        "DYLD_INSERT_LIBRARIES",
        "NODE_OPTIONS",
        "NODE_PATH",
        "PATH",
        "HOME",
        "SHELL",
        "IFS",
        "BASH_ENV",
        "ENV",
        "PYTHONPATH",
        "PYTHONSTARTUP",
        "RUBYOPT",
        "PERL5OPT",
        "JAVA_TOOL_OPTIONS",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
      ])("rejects %s even when the profile declares it", async (envVar) => {
        const { service, calls } = create((args) =>
          args[1] === "list-profiles"
            ? {
                stdout: JSON.stringify([
                  { id: "github", credentials: [{ name: "t", env_vars: [envVar] }] },
                ]),
              }
            : {},
        );
        expect(await service.addCredential(withEnv(envVar))).toEqual({
          ok: false,
          error: "invalidInput",
        });
        expect(calls.some((c) => c.args[1] === "create")).toBe(false);
      });

      it("rejects an env var the profile does not declare, without creating anything", async () => {
        const { service, calls } = create();
        expect(await service.addCredential(withEnv("NOT_DECLARED"))).toEqual({
          ok: false,
          error: "invalidInput",
        });
        expect(calls.map((c) => c.args[1])).toEqual(["list-profiles"]);
      });

      it("rejects a profile id the gateway does not list", async () => {
        const { service, calls } = create();
        expect(await service.addCredential({ ...ADD, profileId: "nope" })).toEqual({
          ok: false,
          error: "invalidInput",
        });
        expect(calls.some((c) => c.args[1] === "create")).toBe(false);
      });

      it("fails, creating nothing, when the profiles cannot be listed or parsed", async () => {
        const failing = create((args) =>
          args[1] === "list-profiles" ? { code: 1, stderr: "x" } : {},
        );
        expect((await failing.service.addCredential(ADD)).ok).toBe(false);
        const garbled = create((args) => (args[1] === "list-profiles" ? { stdout: "nope" } : {}));
        expect((await garbled.service.addCredential(ADD)).ok).toBe(false);
        expect(failing.calls.concat(garbled.calls).some((c) => c.args[1] === "create")).toBe(false);
      });

      it("records the gateway and strips bidi and zero-width characters from the label", async () => {
        const { service, registry } = create();
        await service.addCredential({
          ...ADD,
          bindings: [{ ...ADD.bindings[0], label: "a\u202Eb\u200Bc\u2066d\uFEFFe" }],
        });
        const [entry] = await registry.getForSandbox("work", "box");
        expect(entry.gatewayName).toBe("work");
        expect(entry.bindings[0].label).toBe("abcde");
        expect(await registry.getForSandbox("home", "box")).toEqual([]);
      });
    });

    describe("removeCredential across gateways and sandboxes", () => {
      const OTHER_GATEWAY = JSON.stringify({
        version: 1,
        entries: [{ ...JSON.parse(MANAGED).entries[0], gatewayName: "home" }],
      });

      it("never deletes a provider recorded on another gateway, even with the same names", async () => {
        const { service, calls } = create(() => ({}), { registryContent: OTHER_GATEWAY });
        expect(await service.removeCredential(REMOVE)).toEqual({
          ok: false,
          error: "invalidInput",
        });
        expect(calls).toHaveLength(0);
      });

      it("never deletes a provider recorded without a gateway (older file)", async () => {
        const legacy = JSON.parse(MANAGED);
        delete legacy.entries[0].gatewayName;
        const { service, calls } = create(() => ({}), { registryContent: JSON.stringify(legacy) });
        expect(await service.removeCredential(REMOVE)).toEqual({
          ok: false,
          error: "invalidInput",
        });
        expect(calls).toHaveLength(0);
      });

      it("only detaches, and still succeeds, when another sandbox uses the provider", async () => {
        const { service, calls, registry } = create(
          (args) => {
            if (args[0] === "sandbox" && args[1] === "list") {
              return { stdout: JSON.stringify([{ name: "box" }, { name: "other" }]) };
            }
            if (args[1] === "provider" && args[2] === "list") {
              return { stdout: JSON.stringify(["github-box"]) };
            }
            return {};
          },
          { registryContent: MANAGED },
        );
        expect(await service.removeCredential(REMOVE)).toEqual({ ok: true, data: undefined });
        expect(calls.some((c) => c.args[0] === "provider" && c.args[1] === "delete")).toBe(false);
        expect(await registry.getForSandbox("work", "box")).toEqual([]);
      });

      it("deletes when no other sandbox uses it", async () => {
        const { service, calls } = create(
          (args) => {
            if (args[0] === "sandbox" && args[1] === "list") {
              return { stdout: JSON.stringify([{ name: "box" }, { name: "other" }]) };
            }
            return args[1] === "provider" && args[2] === "list"
              ? { stdout: JSON.stringify(["unrelated"]) }
              : {};
          },
          { registryContent: MANAGED },
        );
        expect(await service.removeCredential(REMOVE)).toEqual({ ok: true, data: undefined });
        expect(calls.some((c) => c.args[0] === "provider" && c.args[1] === "delete")).toBe(true);
      });

      it.each([
        [
          "the sandbox list fails",
          (args: string[]) =>
            args[0] === "sandbox" && args[1] === "list" ? { code: 1, stderr: "x" } : {},
        ],
        [
          "a sandbox's provider list fails",
          (args: string[]) =>
            args[0] === "sandbox" && args[1] === "list"
              ? { stdout: JSON.stringify([{ name: "other" }]) }
              : args[1] === "provider" && args[2] === "list"
                ? { code: 1, stderr: "x" }
                : {},
        ],
        [
          "there are more than 50 sandboxes",
          (args: string[]) =>
            args[0] === "sandbox" && args[1] === "list"
              ? {
                  stdout: JSON.stringify(
                    Array.from({ length: 51 }, (_v, i) => ({ name: `s${i}` })),
                  ),
                }
              : { stdout: "[]" },
        ],
        [
          "a sandbox name is not usable",
          (args: string[]) =>
            args[0] === "sandbox" && args[1] === "list"
              ? { stdout: JSON.stringify([{ name: "-bad" }]) }
              : {},
        ],
      ])("only detaches when %s (cannot confirm)", async (_name, handler) => {
        const { service, calls } = create(handler, { registryContent: MANAGED });
        expect(await service.removeCredential(REMOVE)).toEqual({ ok: true, data: undefined });
        expect(calls.some((c) => c.args[0] === "provider" && c.args[1] === "delete")).toBe(false);
      });
    });

    describe("scrubbing bypasses", () => {
      it.each([
        "tok3n:abc123XYZ!",
        "ab12$cd34*ef56",
        "x9{y8}z7w6q5",
        "user:p4ss@host99.example",
        "A1b2C3d4E5f6",
        "deadbeefdeadbeef",
        "0123456789abcdef0123",
      ])("removes %s", (token) => {
        const out = scrubOpenShellMessage(`denied for ${token} today`);
        expect(out).not.toContain(token);
        expect(out).toContain("[removed]");
        expect(out).toContain("denied for");
        expect(out).toContain("today");
      });

      it("keeps ordinary words, names and short mixed text readable", () => {
        expect(scrubOpenShellMessage("sandbox 'box-1' not found, try again in 30s")).toBe(
          "sandbox 'box-1' not found, try again in 30s",
        );
        expect(scrubOpenShellMessage("connection refused (os error 61)")).toBe(
          "connection refused (os error 61)",
        );
      });

      it("scrubs the apply-status detail with the full scrub, not just bw://", async () => {
        const { service } = create((args) =>
          args[1] === "provider" && args[2] === "list"
            ? { stdout: JSON.stringify(["p"]) }
            : {
                stdout: JSON.stringify({ applied: false, message: "waiting on tok3n:abc123XYZ!" }),
              },
        );
        const result = await service.getApplyStatus({ sandboxName: "box" });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.detail).not.toContain("abc123");
          expect(result.data.detail).toContain("[removed]");
        }
      });

      it("scrubs a plain-text status detail too", async () => {
        const { service } = create((args) =>
          args[1] === "provider" && args[2] === "list"
            ? { stdout: JSON.stringify(["p"]) }
            : { stdout: "pending sync of s3cr3t!{k3y}*9 now" },
        );
        const result = await service.getApplyStatus({ sandboxName: "box" });
        expect(result.ok && result.data.detail).not.toContain("s3cr3t");
      });
    });

    describe("apply status provider cap", () => {
      it("asks for at most 8 providers", async () => {
        const { service, calls } = create((args) =>
          args[1] === "provider" && args[2] === "list"
            ? { stdout: JSON.stringify(Array.from({ length: 20 }, (_v, i) => `p${i}`)) }
            : { stdout: JSON.stringify({ applied: true }) },
        );
        await service.getApplyStatus({ sandboxName: "box" });
        expect(calls.filter((c) => c.args[2] === "status")).toHaveLength(8);
      });
    });
  });
});
