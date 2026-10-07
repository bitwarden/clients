import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OpenShellDetectionResult } from "../models/openshell";

import { OpenShellEnabledState } from "./openshell-enabled-state";
import {
  OpenShellManagementExec,
  OpenShellManagementExecResult,
} from "./openshell-management.service";
import { OpenShellPortsFs, OpenShellPortsService, quoteShellWord } from "./openshell-ports.service";
import { OpenShellSavedPortsFs, OpenShellSavedPortsService } from "./openshell-saved-ports.service";

const CLI = "/opt/homebrew/bin/openshell";
const G = "--gateway=work";

const detection = (
  overrides: Partial<OpenShellDetectionResult> = {},
): OpenShellDetectionResult => ({
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
});

type Handler = (file: string, args: string[]) => Partial<OpenShellManagementExecResult>;

function create(
  handler: Handler = () => ({}),
  options: {
    det?: OpenShellDetectionResult;
    available?: boolean;
    enabled?: boolean;
    platform?: NodeJS.Platform;
    modes?: Record<string, number>;
    cliPath?: string;
  } = {},
) {
  const calls: { file: string; args: string[]; timeoutMs: number }[] = [];
  const exec: OpenShellManagementExec = {
    run: jest.fn(async (file: string, args: string[], timeoutMs: number) => {
      calls.push({ file, args, timeoutMs });
      return { code: 0, stdout: "", stderr: "", ...handler(file, args) };
    }),
  };
  const scripts: { content: string; removed: boolean }[] = [];
  const fsAdapter: OpenShellPortsFs = {
    stat: jest.fn(async (p: string) => ({ mode: options.modes?.[p] ?? 0o100755 })),
    writeExecutableTempFile: jest.fn(async (content: string) => {
      const script = { content, removed: false };
      scripts.push(script);
      return {
        filePath: "/tmp/bitwarden-openshell-shell-x/connect-1.command",
        remove: async () => {
          script.removed = true;
        },
      };
    }),
  };
  const store = { content: null as string | null };
  const savedFs: OpenShellSavedPortsFs = {
    read: jest.fn(async () => store.content),
    writeAtomic: jest.fn(async (_p: string, content: string) => {
      store.content = content;
    }),
  };
  const log = mock<LogService>();
  const state = new OpenShellEnabledState();
  state.set(options.enabled ?? true);
  const service = new OpenShellPortsService(
    log,
    async () => options.det ?? detection(options.cliPath ? { cliPath: options.cliPath } : {}),
    async () => options.available ?? true,
    new OpenShellSavedPortsService(log, "/data", savedFs),
    exec,
    fsAdapter,
    state,
    options.platform ?? "darwin",
  );
  return { service, calls, exec, fsAdapter, scripts, log, savedFs, store };
}

const forwardsJson = (items: unknown[]) => JSON.stringify(items);

describe("OpenShellPortsService.listForwards", () => {
  it("runs a read-only list and returns only this sandbox's forwards", async () => {
    const { service, calls } = create(() => ({
      stdout: forwardsJson([
        { sandbox: "box", port: 8080, bind_address: "127.0.0.1", pid: 4242 },
        { sandbox: "other", port: 9090 },
        { sandbox: "box", local_port: "3000" },
        { sandbox: "box", port: 0 },
      ]),
    }));
    const result = await service.listForwards({ sandboxName: "box" });
    expect(result).toEqual({
      ok: true,
      data: [
        { sandboxName: "box", port: 8080, bindAddress: "127.0.0.1", pid: 4242 },
        { sandboxName: "box", port: 3000, bindAddress: "", pid: null },
      ],
    });
    expect(calls).toEqual([
      { file: CLI, args: ["forward", "list", G, "-o", "json"], timeoutMs: 15_000 },
    ]);
  });

  it.each(["[]", "", "No active forwards.\n"])("treats %p as no forwards", async (stdout) => {
    const { service } = create(() => ({ stdout }));
    expect(await service.listForwards({ sandboxName: "box" })).toEqual({ ok: true, data: [] });
  });

  it("accepts an object with a forwards list and a [bind:]port string", async () => {
    const { service } = create(() => ({
      stdout: JSON.stringify({ forwards: [{ name: "box", local: "0.0.0.0:8080" }] }),
    }));
    const result = await service.listForwards({ sandboxName: "box" });
    expect(result.data).toEqual([
      { sandboxName: "box", port: 8080, bindAddress: "0.0.0.0", pid: null },
    ]);
  });

  it("fails on unparseable output and on a list that never names a sandbox", async () => {
    expect(
      (await create(() => ({ stdout: "garbage" })).service.listForwards({ sandboxName: "box" })).ok,
    ).toBe(false);
    const missing = await create(() => ({
      stdout: forwardsJson([{ port: 80 }]),
    })).service.listForwards({
      sandboxName: "box",
    });
    expect(missing.ok).toBe(false);
    expect(missing.error).toBe("failed");
  });

  it("rejects invalid input before any process", async () => {
    const { service, calls } = create();
    for (const request of [
      null,
      {},
      { sandboxName: "-x" },
      { sandboxName: "a b" },
      { sandboxName: 5 },
    ]) {
      expect(await service.listForwards(request)).toEqual({ ok: false, error: "invalidInput" });
    }
    expect(calls).toHaveLength(0);
  });
});

describe("OpenShellPortsService.startForward / stopForward", () => {
  it("starts a background loopback forward with argument arrays only", async () => {
    const { service, calls } = create();
    expect(await service.startForward({ sandboxName: "box", port: 8080 })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(calls).toEqual([
      {
        file: CLI,
        args: ["forward", "start", G, "--background", "127.0.0.1:8080", "box"],
        timeoutMs: 60_000,
      },
    ]);
  });

  it("ignores any bind address or extra field a caller sends", async () => {
    const { service, calls } = create();
    await service.startForward({
      sandboxName: "box",
      port: 8080,
      bindAddress: "0.0.0.0",
      targetPort: 1,
    });
    expect(calls[0].args).toContain("127.0.0.1:8080");
    expect(calls[0].args.join(" ")).not.toContain("0.0.0.0");
  });

  it.each([0, 65536, -5, 1.5, "80", null, undefined, NaN])(
    "rejects port %p without a process",
    async (port) => {
      const { service, calls } = create();
      expect(await service.startForward({ sandboxName: "box", port })).toEqual({
        ok: false,
        error: "invalidInput",
      });
      expect(await service.stopForward({ sandboxName: "box", port })).toEqual({
        ok: false,
        error: "invalidInput",
      });
      expect(calls).toHaveLength(0);
    },
  );

  it("rejects an invalid sandbox name", async () => {
    const { service, calls } = create();
    for (const sandboxName of ["--help", "a;b", "a b", "", "$(x)"]) {
      expect((await service.startForward({ sandboxName, port: 80 })).error).toBe("invalidInput");
    }
    expect(calls).toHaveLength(0);
  });

  it("stops by port and sandbox", async () => {
    const { service, calls } = create();
    expect((await service.stopForward({ sandboxName: "box", port: 443 })).ok).toBe(true);
    expect(calls[0].args).toEqual(["forward", "stop", G, "443", "box"]);
  });

  it("maps CLI failures to scrubbed envelope errors", async () => {
    const used = create(() => ({ code: 1, stderr: "Error: address already in use" }));
    expect(await used.service.startForward({ sandboxName: "box", port: 80 })).toMatchObject({
      ok: false,
      error: "alreadyExists",
    });
    const secret = create(() => ({
      code: 1,
      stderr: "boom bw://item/0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33#password",
    }));
    const failed = await secret.service.startForward({ sandboxName: "box", port: 80 });
    expect(failed.message).not.toContain("bw://");
    const down = create(() => ({ code: 1, stderr: "connection refused" }));
    expect((await down.service.stopForward({ sandboxName: "box", port: 80 })).error).toBe(
      "gatewayUnreachable",
    );
    const missing = create(() => ({ code: 127, spawnFailed: true }));
    expect((await missing.service.startForward({ sandboxName: "box", port: 80 })).error).toBe(
      "cliMissing",
    );
  });

  it("reports a timed-out mutation as failed, not unreachable", async () => {
    const { service } = create(() => ({ code: 1, stderr: "timed out", timedOut: true }));
    const result = await service.startForward({ sandboxName: "box", port: 80 });
    expect(result.error).toBe("failed");
  });

  it("never throws across IPC", async () => {
    const { service, exec } = create();
    (exec.run as jest.Mock).mockRejectedValueOnce(new Error("spawn exploded"));
    expect(await service.startForward({ sandboxName: "box", port: 80 })).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("OpenShellPortsService gate", () => {
  it("is unsupported when the toggle is off, management unavailable, or OpenShell absent", async () => {
    for (const options of [
      { enabled: false },
      { available: false },
      { det: detection({ present: false }) },
      { det: detection({ platformSupported: false }) },
    ]) {
      const { service, calls } = create(undefined, options);
      expect((await service.listForwards({ sandboxName: "box" })).error).toBe("unsupported");
      expect((await service.startForward({ sandboxName: "box", port: 80 })).error).toBe(
        "unsupported",
      );
      expect((await service.openShell({ sandboxName: "box", action: "copyCommand" })).error).toBe(
        "unsupported",
      );
      expect((await service.getSavedPorts({ sandboxName: "box" })).error).toBe("unsupported");
      expect(calls).toHaveLength(0);
    }
  });

  it("refuses a group-writable binary", async () => {
    const { service, calls } = create(undefined, { modes: { [CLI]: 0o100775 } });
    const result = await service.startForward({ sandboxName: "box", port: 80 });
    expect(result).toMatchObject({ ok: false, error: "failed" });
    expect(calls).toHaveLength(0);
  });
});

describe("OpenShellPortsService.openShell", () => {
  it("copyCommand returns the command and runs nothing", async () => {
    const { service, calls, fsAdapter } = create();
    expect(await service.openShell({ sandboxName: "box", action: "copyCommand" })).toEqual({
      ok: true,
      data: { command: `${CLI} sandbox connect ${G} box`, launched: false },
    });
    expect(calls).toHaveLength(0);
    expect(fsAdapter.writeExecutableTempFile).not.toHaveBeenCalled();
  });

  it("quotes a CLI path with spaces or quotes", async () => {
    const { service } = create(undefined, { cliPath: "/Users/o'brien/my tools/openshell" });
    const result = await service.openShell({ sandboxName: "box", action: "copyCommand" });
    expect(result.data!.command).toBe(
      `'/Users/o'\\''brien/my tools/openshell' sandbox connect ${G} box`,
    );
  });

  it("opens Terminal on macOS through a private script and /usr/bin/open", async () => {
    const { service, calls, scripts } = create();
    const result = await service.openShell({ sandboxName: "box", action: "openTerminal" });
    expect(result).toEqual({
      ok: true,
      data: { command: `${CLI} sandbox connect ${G} box`, launched: true },
    });
    expect(calls).toEqual([
      {
        file: "/usr/bin/open",
        args: ["-a", "Terminal", "/tmp/bitwarden-openshell-shell-x/connect-1.command"],
        timeoutMs: 10_000,
      },
    ]);
    expect(scripts[0].content).toBe(
      `#!/bin/sh\nrm -rf -- "$(dirname -- "$0")" 2>/dev/null\nexec ${CLI} sandbox connect ${G} box\n`,
    );
  });

  it("removes the script when the launch fails, and on a timer otherwise", async () => {
    jest.useFakeTimers();
    try {
      const failing = create(() => ({ code: 1 }));
      const failed = await failing.service.openShell({
        sandboxName: "box",
        action: "openTerminal",
      });
      expect(failed.ok).toBe(false);
      expect(failing.scripts[0].removed).toBe(true);

      const good = create();
      await good.service.openShell({ sandboxName: "box", action: "openTerminal" });
      expect(good.scripts[0].removed).toBe(false);
      await jest.advanceTimersByTimeAsync(60_000);
      expect(good.scripts[0].removed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("offers only the copy action off macOS", async () => {
    const { service, calls, fsAdapter } = create(undefined, { platform: "linux" });
    expect((await service.openShell({ sandboxName: "box", action: "openTerminal" })).error).toBe(
      "unsupported",
    );
    expect((await service.openShell({ sandboxName: "box", action: "copyCommand" })).ok).toBe(true);
    expect(calls).toHaveLength(0);
    expect(fsAdapter.writeExecutableTempFile).not.toHaveBeenCalled();
  });

  it("refuses a CLI path with control characters before writing a script", async () => {
    const { service, fsAdapter } = create(undefined, { cliPath: "/opt/open\nshell" });
    const result = await service.openShell({ sandboxName: "box", action: "openTerminal" });
    expect(result.ok).toBe(false);
    expect(fsAdapter.writeExecutableTempFile).not.toHaveBeenCalled();
  });

  it("validates the request", async () => {
    const { service, calls } = create();
    for (const request of [
      { sandboxName: "box", action: "rm" },
      { sandboxName: "box; rm -rf /", action: "copyCommand" },
      { sandboxName: "$(id)", action: "openTerminal" },
      { action: "copyCommand" },
      null,
    ]) {
      expect(await service.openShell(request)).toEqual({ ok: false, error: "invalidInput" });
    }
    expect(calls).toHaveLength(0);
  });

  it("quoteShellWord leaves safe words bare and quotes the rest", () => {
    expect(quoteShellWord("--gateway=work")).toBe("--gateway=work");
    expect(quoteShellWord("a b")).toBe("'a b'");
    expect(quoteShellWord("$(id)")).toBe("'$(id)'");
    expect(quoteShellWord("it's")).toBe(`'it'\\''s'`);
  });
});

describe("OpenShellPortsService saved ports", () => {
  it("keeps saved ports per gateway and sandbox, cleaned", async () => {
    const { service, store } = create();
    const set = await service.setSavedPorts({
      sandboxName: "box",
      ports: [{ port: 8080, name: "Web\u202E vault" }, { port: 0 }, { port: 8080 }],
    });
    expect(set).toEqual({ ok: true, data: [{ port: 8080, name: "Web vault" }] });
    expect(await service.getSavedPorts({ sandboxName: "box" })).toEqual({
      ok: true,
      data: [{ port: 8080, name: "Web vault" }],
    });
    expect(JSON.parse(store.content!).entries[0].gatewayName).toBe("work");
    expect(await service.getSavedPorts({ sandboxName: "other" })).toEqual({ ok: true, data: [] });
  });

  it("validates requests and reports a failed write", async () => {
    const { service, savedFs } = create();
    expect((await service.setSavedPorts({ sandboxName: "box", ports: "x" })).error).toBe(
      "invalidInput",
    );
    expect((await service.setSavedPorts({ sandboxName: "-x", ports: [] })).error).toBe(
      "invalidInput",
    );
    expect((await service.getSavedPorts(null)).error).toBe("invalidInput");
    (savedFs.writeAtomic as jest.Mock).mockRejectedValueOnce(new Error("disk"));
    expect((await service.setSavedPorts({ sandboxName: "box", ports: [{ port: 1 }] })).error).toBe(
      "failed",
    );
  });
});
