import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OpenShellDetectionResult } from "../models/openshell";

import {
  OpenShellSetupExec,
  OpenShellSetupFs,
  OpenShellSetupService,
} from "./openshell-setup.service";

const CONFIG = "/opt/homebrew/var/openshell/gateway.toml";
const AAC = "/Applications/Bitwarden.app/Contents/MacOS/aac";
const BREW = "/opt/homebrew/bin/brew";

const EXISTING = [
  "[openshell]",
  "version = 2",
  "",
  "# Docker Desktop has host networking off.",
  "[openshell.drivers.docker]",
  'grpc_endpoint = "https://host.docker.internal:17670"',
  "",
].join("\n");

function detection(overrides: Partial<OpenShellDetectionResult> = {}): OpenShellDetectionResult {
  return {
    present: true,
    platformSupported: true,
    gateways: [
      {
        name: "openshell",
        endpoint: "https://127.0.0.1:17670",
        authMode: "mtls",
        active: true,
        authSupported: true,
      },
    ],
    gatewayConfigPath: CONFIG,
    gatewayConfigPathHint: CONFIG,
    ...overrides,
  };
}

/** An in-memory stand-in for the filesystem that records every write. */
function fakeFs(files: Record<string, string>) {
  const writes: { path: string; content: string }[] = [];
  const copies: { from: string; to: string }[] = [];
  const adapter: OpenShellSetupFs = {
    read: jest.fn(async (filePath: string) => files[filePath] ?? null),
    writeAtomic: jest.fn(async (filePath: string, content: string) => {
      writes.push({ path: filePath, content });
      files[filePath] = content;
    }),
    copyExclusive: jest.fn(async (from: string, to: string) => {
      copies.push({ from, to });
      files[to] = files[from];
    }),
    exists: jest.fn(async (filePath: string) => filePath in files || filePath === BREW),
  };
  return { adapter, writes, copies, files };
}

function fakeExec(
  handler: (file: string, args: string[]) => { code: number; stdout?: string } = () => ({
    code: 0,
  }),
) {
  const calls: { file: string; args: string[] }[] = [];
  const exec: OpenShellSetupExec = {
    run: jest.fn(async (file: string, args: string[]) => {
      calls.push({ file, args });
      const result = handler(file, args);
      return { code: result.code, stdout: result.stdout ?? "" };
    }),
  };
  return { exec, calls };
}

const BREW_LIST = JSON.stringify([
  { name: "postgresql@16", status: "started" },
  { name: "openshell", status: "started" },
]);

function brewHandler(file: string, args: string[]) {
  if (args[0] === "services" && args[1] === "list") {
    return { code: 0, stdout: BREW_LIST };
  }
  return { code: 0 };
}

function build(options: {
  files?: Record<string, string>;
  detect?: OpenShellDetectionResult;
  aacPath?: string | null;
  platform?: NodeJS.Platform;
  execHandler?: (file: string, args: string[]) => { code: number; stdout?: string };
}) {
  const f = fakeFs(options.files ?? { [CONFIG]: EXISTING });
  const e = fakeExec(options.execHandler ?? brewHandler);
  const service = new OpenShellSetupService(
    mock<LogService>(),
    async () => options.detect ?? detection(),
    async () => (options.aacPath === undefined ? AAC : options.aacPath),
    "/Users/demo",
    options.platform ?? "darwin",
    f.adapter,
    e.exec,
    () => new Date(2026, 9, 7, 8, 5, 3),
  );
  return { service, ...f, ...e };
}

describe("OpenShellSetupService", () => {
  describe("getStatus", () => {
    it("reports a config without the driver as not yet configured, and writes nothing", async () => {
      const { service, writes, calls } = build({});

      const status = await service.getStatus();

      expect(status).toEqual({
        configPath: CONFIG,
        configured: false,
        canSetUp: true,
        restartMethod: "brew",
      });
      expect(writes).toEqual([]);
      expect(calls).toEqual([]);
    });

    it("reports a config that already has the driver as configured", async () => {
      const { service, files } = build({});
      await service.setUp();
      const reread = build({ files: { [CONFIG]: files[CONFIG] } });

      expect((await reread.service.getStatus()).configured).toBe(true);
    });

    it("is not configured when the driver points at a different aac", async () => {
      const { service, files } = build({});
      await service.setUp();

      const moved = build({ files: { [CONFIG]: files[CONFIG] }, aacPath: "/elsewhere/aac" });

      expect((await moved.service.getStatus()).configured).toBe(false);
    });

    it("flags a file it can't edit safely", async () => {
      const { service } = build({
        files: { [CONFIG]: '[openshell.gateway]\ncredential_drivers = [\n  "x",\n]\n' },
      });

      const status = await service.getStatus();

      expect(status.canSetUp).toBe(true);
      expect(status.blockedReason).toBe("unmergeable");
    });

    it("can't set up without a bundled aac", async () => {
      const { service } = build({ aacPath: null });

      expect(await service.getStatus()).toMatchObject({
        canSetUp: false,
        blockedReason: "noBundledCli",
      });
    });

    it("can't set up where OpenShell isn't supported", async () => {
      const { service } = build({ detect: detection({ platformSupported: false }) });

      expect(await service.getStatus()).toMatchObject({
        canSetUp: false,
        blockedReason: "unsupported",
      });
    });

    it("falls back to a manual restart on Linux without a user systemd unit", async () => {
      const { service } = build({ platform: "linux" });

      expect((await service.getStatus()).restartMethod).toBe("manual");
    });

    it("uses systemd on Linux when the gateway has a user unit", async () => {
      const { service } = build({
        platform: "linux",
        detect: detection({ systemdUnitPath: "/usr/lib/systemd/user/openshell-gateway.service" }),
        files: { [CONFIG]: EXISTING, "/usr/bin/systemctl": "" },
      });

      expect((await service.getStatus()).restartMethod).toBe("systemd");
    });
  });

  describe("setUp", () => {
    it("backs the file up, writes the merged config, then restarts the gateway", async () => {
      const { service, writes, copies, calls } = build({});

      const result = await service.setUp();

      expect(result).toMatchObject({
        ok: true,
        configChanged: true,
        restarted: true,
        restartMethod: "brew",
        backupPath: `${CONFIG}.bak-bitwarden-20261007080503`,
      });
      expect(typeof result.restartedAtMs).toBe("number");
      expect(copies).toEqual([{ from: CONFIG, to: `${CONFIG}.bak-bitwarden-20261007080503` }]);
      expect(writes).toHaveLength(1);
      expect(writes[0].path).toBe(CONFIG);
      expect(writes[0].content).toContain("[openshell.credential_drivers.bitwarden]");
      expect(writes[0].content).toContain(`command = "${AAC}"`);
      expect(writes[0].content).toContain("[openshell.drivers.docker]");
      expect(calls).toEqual([
        { file: BREW, args: ["services", "list", "--json"] },
        { file: BREW, args: ["services", "restart", "openshell"] },
      ]);
    });

    it("never rewrites a config that is already correct, but still restarts", async () => {
      const first = build({});
      await first.service.setUp();
      const { service, writes, copies, calls } = build({
        files: { [CONFIG]: first.files[CONFIG] },
      });

      const result = await service.setUp();

      expect(result).toMatchObject({ ok: true, configChanged: false, restarted: true });
      expect(result.backupPath).toBeUndefined();
      expect(writes).toEqual([]);
      expect(copies).toEqual([]);
      expect(calls.at(-1)?.args).toEqual(["services", "restart", "openshell"]);
    });

    it("creates the file when the gateway has none yet, without a backup", async () => {
      const { service, writes, copies } = build({ files: {} });

      const result = await service.setUp();

      expect(result).toMatchObject({ ok: true, configChanged: true });
      expect(copies).toEqual([]);
      expect(writes[0].content).toContain('credential_drivers = ["bitwarden"]');
    });

    it("leaves a file it can't merge untouched and doesn't restart", async () => {
      const unmergeable = '[openshell.gateway]\ncredential_drivers = [\n  "x",\n]\n';
      const { service, writes, copies, calls } = build({ files: { [CONFIG]: unmergeable } });

      const result = await service.setUp();

      expect(result).toMatchObject({
        ok: false,
        failure: "unmergeable",
        configChanged: false,
        restarted: false,
      });
      expect(result.detail).toContain("single-line");
      expect(writes).toEqual([]);
      expect(copies).toEqual([]);
      expect(calls).toEqual([]);
    });

    it("reports the config as changed when only the restart fails, so the UI can say so", async () => {
      const { service } = build({
        execHandler: (_file, args) =>
          args[1] === "list" ? { code: 0, stdout: BREW_LIST } : { code: 1 },
      });

      const result = await service.setUp();

      expect(result).toMatchObject({
        ok: false,
        failure: "restartFailed",
        configChanged: true,
        restarted: false,
      });
      expect(result.backupPath).toContain(".bak-bitwarden-");
    });

    it("fails the restart, not the config, when no brew service looks like OpenShell", async () => {
      const { service, writes } = build({
        execHandler: () => ({ code: 0, stdout: JSON.stringify([{ name: "postgresql@16" }]) }),
      });

      const result = await service.setUp();

      expect(result).toMatchObject({ ok: false, failure: "restartFailed", configChanged: true });
      expect(writes).toHaveLength(1);
    });

    it("reports notWritable and restarts nothing when the write is refused", async () => {
      const { service, adapter, calls } = build({});
      (adapter.writeAtomic as jest.Mock).mockRejectedValueOnce(new Error("EACCES"));

      const result = await service.setUp();

      expect(result).toMatchObject({ ok: false, failure: "notWritable", restarted: false });
      expect(calls).toEqual([]);
    });

    it("asks for a manual restart when it can't restart the gateway itself", async () => {
      const { service, writes } = build({ platform: "linux" });

      const result = await service.setUp();

      expect(result).toMatchObject({
        ok: false,
        failure: "restartFailed",
        configChanged: true,
        restartMethod: "manual",
      });
      expect(writes).toHaveLength(1);
    });

    it("refuses outright when unsupported", async () => {
      const { service, writes, calls } = build({ detect: detection({ platformSupported: false }) });

      expect(await service.setUp()).toMatchObject({ ok: false, failure: "unsupported" });
      expect(writes).toEqual([]);
      expect(calls).toEqual([]);
    });

    it("restarts with systemctl --user on Linux", async () => {
      const { service, calls } = build({
        platform: "linux",
        detect: detection({ systemdUnitPath: "/usr/lib/systemd/user/openshell-gateway.service" }),
        files: { [CONFIG]: EXISTING, "/usr/bin/systemctl": "" },
      });

      const result = await service.setUp();

      expect(result).toMatchObject({ ok: true, restartMethod: "systemd" });
      expect(calls).toEqual([
        { file: "/usr/bin/systemctl", args: ["--user", "restart", "openshell-gateway.service"] },
      ]);
    });

    it("ignores a brew service name that isn't a plain identifier", async () => {
      const { service, calls } = build({
        execHandler: (_file, args) =>
          args[1] === "list"
            ? { code: 0, stdout: JSON.stringify([{ name: "openshell; rm -rf ~" }]) }
            : { code: 0 },
      });

      const result = await service.setUp();

      expect(result.failure).toBe("restartFailed");
      expect(calls.every((call) => !call.args.includes("restart"))).toBe(true);
    });
  });

  describe("remove", () => {
    it("takes the driver back out, with a backup, and restarts", async () => {
      const setUp = build({});
      await setUp.service.setUp();
      const { service, writes, copies, calls } = build({
        files: { [CONFIG]: setUp.files[CONFIG] },
      });

      const result = await service.remove();

      expect(result).toMatchObject({ ok: true, configChanged: true, restarted: true });
      expect(copies).toHaveLength(1);
      expect(writes[0].content).toBe(EXISTING.trimEnd() + "\n");
      expect(calls.at(-1)?.args).toEqual(["services", "restart", "openshell"]);
    });

    it("is a no-op for the file when the driver was never added", async () => {
      const { service, writes } = build({});

      const result = await service.remove();

      expect(result).toMatchObject({ ok: true, configChanged: false });
      expect(writes).toEqual([]);
    });
  });
});
