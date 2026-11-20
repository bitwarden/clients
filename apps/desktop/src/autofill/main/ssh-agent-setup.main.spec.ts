import { existsSync, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { ipcMain } from "electron";

import { SSH_AGENT_SETUP_IPC_CHANNELS } from "../models/ipc-channels";
import {
  SshAgentSetupApi,
  SshAgentSetupMode,
  SshAgentSetupOverallStatus,
  SshAgentSetupPackaging,
  SshAgentSetupPlatform,
  SshAgentSetupStepKind,
  SshAgentSetupStepStatus,
  SshAgentVerifyOutcome,
} from "../models/ssh-agent-setup";

import { SshAgentSetupBlockedReason } from "./ssh-agent-setup-fs";
import { MANAGED_BLOCK_BEGIN, MANAGED_BLOCK_END } from "./ssh-agent-setup-templates";
import { ExecFileFn, ExecFileOptions } from "./ssh-agent-setup-verify";
import {
  registerSshAgentSetupIpcHandlers,
  SshAgentSetupDeps,
  SshAgentSetupService,
} from "./ssh-agent-setup.main";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
}));

const uid = process.getuid!();
const FIXED_NOW = new Date("2026-11-19T10:00:00.000Z");

let root: string;
let home: string;
let socket: string;

async function readText(p: string): Promise<string> {
  return fs.readFile(p, "utf8");
}

async function mode(p: string): Promise<number> {
  return (await fs.stat(p)).mode & 0o777;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

/** Every file below `dir` with its content, for before/after comparisons. */
async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (d: string) => {
    for (const entry of await fs.readdir(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out[path.relative(dir, full)] = await readText(full);
      } else {
        out[path.relative(dir, full)] = "<special>";
      }
    }
  };
  await walk(dir);
  return out;
}

function makeDeps(overrides: Partial<SshAgentSetupDeps> = {}): SshAgentSetupDeps {
  return {
    platform: SshAgentSetupPlatform.Linux,
    packaging: SshAgentSetupPackaging.Standard,
    home,
    homeOverridden: true,
    uid,
    loginShell: "zsh",
    env: {},
    runtimeDir: path.join(root, "run"),
    hostname: "testhost",
    native: {
      getSocketAddress: jest.fn(() => socket),
      probeAddress: jest.fn(async () => true),
    },
    agentState: { isRunning: () => true, isEnabled: () => true, startErrorCode: () => undefined },
    execFile: jest.fn<ReturnType<ExecFileFn>, Parameters<ExecFileFn>>(async () => ({
      stdout: "",
    })),
    sshBinaries: [process.execPath],
    now: () => FIXED_NOW,
    logService: { info: jest.fn(), warning: jest.fn() },
    ...overrides,
  };
}

async function applyAll(service: SshAgentSetupService) {
  const plan = await service.getPlan();
  return {
    plan,
    results: await service.apply(
      plan.planId,
      plan.steps.map((s) => s.id),
    ),
  };
}

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "bw-ssh-setup-spec-")));
  home = path.join(root, "home");
  await fs.mkdir(home, { mode: 0o700 });
  await fs.mkdir(path.join(root, "run"), { mode: 0o700 });
  socket = path.join(home, ".bitwarden-ssh-agent.sock");
  // Specs must never see the real home, even by accident.
  expect(home.startsWith(os.homedir() + path.sep) && !home.startsWith(os.tmpdir())).toBe(false);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  jest.clearAllMocks();
});

describe("SshAgentSetupService", () => {
  describe("plan and apply (requirement 2)", () => {
    it("writes the app-owned include file and one marked block at the top of ~/.ssh/config", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".ssh/config"), "Host work\n  User me\n", {
        mode: 0o644,
      });
      const service = new SshAgentSetupService(makeDeps());

      const { plan, results } = await applyAll(service);

      const agentConf = path.join(home, ".ssh/bitwarden/agent.conf");
      expect(plan.steps.map((s) => [s.id, s.kind, s.status])).toEqual([
        ["ssh-config", SshAgentSetupStepKind.SshConfigInclude, SshAgentSetupStepStatus.Pending],
        ["shell-zsh", SshAgentSetupStepKind.ShellProfile, SshAgentSetupStepStatus.Pending],
      ]);
      expect(plan.steps[0].displayPath).toBe("~/.ssh/config");
      expect(plan.steps[0].addedLines).toEqual([
        MANAGED_BLOCK_BEGIN,
        `Include ${agentConf}`,
        MANAGED_BLOCK_END,
      ]);
      expect(results.every((r) => r.status === SshAgentSetupStepStatus.Applied)).toBe(true);
      expect(await readText(path.join(home, ".ssh/config"))).toBe(
        `${MANAGED_BLOCK_BEGIN}\nInclude ${agentConf}\n${MANAGED_BLOCK_END}\nHost work\n  User me\n`,
      );
      expect(await readText(agentConf)).toBe(
        "# Managed by Bitwarden. Removed when you undo SSH agent setup in Bitwarden.\n" +
          `Host *\n  IdentityAgent "${socket}"\n`,
      );
      expect(await mode(agentConf)).toBe(0o600);
      expect(await mode(path.join(home, ".ssh/bitwarden"))).toBe(0o700);
      // Existing mode is preserved.
      expect(await mode(path.join(home, ".ssh/config"))).toBe(0o644);
    });

    it("uses `Include ~/.ssh/bitwarden/agent.conf` when the home directory is not overridden", async () => {
      const service = new SshAgentSetupService(makeDeps({ homeOverridden: false }));

      await applyAll(service);

      expect(await readText(path.join(home, ".ssh/config"))).toBe(
        `${MANAGED_BLOCK_BEGIN}\nInclude ~/.ssh/bitwarden/agent.conf\n${MANAGED_BLOCK_END}\n`,
      );
    });

    it("creates ~/.ssh with 0700 and a new ~/.ssh/config with 0600", async () => {
      const service = new SshAgentSetupService(makeDeps());

      await applyAll(service);

      expect(await mode(path.join(home, ".ssh"))).toBe(0o700);
      expect(await mode(path.join(home, ".ssh/config"))).toBe(0o600);
    });

    it("appends a marked export block to .zshrc that does not override forwarded agents", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), "alias ll='ls -l'", { mode: 0o644 });
      const service = new SshAgentSetupService(makeDeps());

      await applyAll(service);

      expect(await readText(path.join(home, ".zshrc"))).toBe(
        "alias ll='ls -l'\n" +
          `${MANAGED_BLOCK_BEGIN}\n` +
          `if [ -z "\${SSH_CONNECTION:-}" ]; then export SSH_AUTH_SOCK='${socket}'; fi\n` +
          `${MANAGED_BLOCK_END}\n`,
      );
      expect(await mode(path.join(home, ".zshrc"))).toBe(0o644);
    });

    it("writes an app-owned fish drop-in and never touches config.fish", async () => {
      await fs.mkdir(path.join(home, ".config/fish"), { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(home, ".config/fish/config.fish"), "set -gx EDITOR vim\n");
      const service = new SshAgentSetupService(makeDeps({ loginShell: "fish" }));

      const { plan } = await applyAll(service);

      const dropIn = path.join(home, ".config/fish/conf.d/bitwarden-ssh-agent.fish");
      expect(plan.steps[1].displayPath).toBe("~/.config/fish/conf.d/bitwarden-ssh-agent.fish");
      expect(await readText(dropIn)).toContain(`    set -gx SSH_AUTH_SOCK '${socket}'`);
      expect(await readText(dropIn)).toContain("if not set -q SSH_CONNECTION");
      expect(await mode(dropIn)).toBe(0o600);
      expect(await readText(path.join(home, ".config/fish/config.fish"))).toBe(
        "set -gx EDITOR vim\n",
      );
    });

    it("only proposes ~/.bashrc for bash users when it already exists", async () => {
      const service = new SshAgentSetupService(makeDeps({ loginShell: "bash" }));
      expect((await service.getPlan()).steps.map((s) => s.id)).toEqual(["ssh-config"]);

      await fs.writeFile(path.join(home, ".bashrc"), "# bash\n");
      expect((await service.getPlan()).steps.map((s) => s.id)).toEqual([
        "ssh-config",
        "shell-bash",
      ]);
    });

    it("creates nothing for shells that are not in use and offers a copy-ready export instead", async () => {
      const service = new SshAgentSetupService(makeDeps({ loginShell: null }));

      const { plan } = await applyAll(service);

      expect(plan.steps.map((s) => s.id)).toEqual(["ssh-config"]);
      expect(plan.guidedCommands.map((c) => c.command)).toEqual([
        `export SSH_AUTH_SOCK='${socket}'`,
        `set -gx SSH_AUTH_SOCK '${socket}'`,
      ]);
      expect(await exists(path.join(home, ".zshrc"))).toBe(false);
      expect(await exists(path.join(home, ".bashrc"))).toBe(false);
      expect(await exists(path.join(home, ".config"))).toBe(false);
    });

    it("is idempotent: applying twice yields byte-identical files", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), "export EDITOR=vim\n");
      const service = new SshAgentSetupService(makeDeps());
      await applyAll(service);
      const first = await snapshot(home);

      const { plan, results } = await applyAll(service);

      expect(plan.steps.map((s) => s.status)).toEqual([
        SshAgentSetupStepStatus.AlreadyConfigured,
        SshAgentSetupStepStatus.AlreadyConfigured,
      ]);
      expect(plan.steps.every((s) => s.addedLines.length === 0)).toBe(true);
      expect(results.map((r) => r.status)).toEqual([
        SshAgentSetupStepStatus.AlreadyConfigured,
        SshAgentSetupStepStatus.AlreadyConfigured,
      ]);
      expect(await snapshot(home)).toEqual(first);
    });

    it("leaves no temp files behind", async () => {
      const service = new SshAgentSetupService(makeDeps());
      await applyAll(service);

      const names = Object.keys(await snapshot(home));
      expect(names.filter((n) => n.includes(".bw-tmp-"))).toEqual([]);
    });
  });

  describe("renderer input (requirement 1)", () => {
    it("forwards only planId and stepIds from IPC; extra renderer values never reach the service", async () => {
      const handlers = new Map<string, (...args: unknown[]) => unknown>();
      jest
        .mocked(ipcMain.handle)
        .mockImplementation((channel: string, handler: (...args: any[]) => unknown) => {
          handlers.set(channel, handler);
        });
      const service: jest.Mocked<SshAgentSetupApi> = {
        getEnvironment: jest.fn(),
        getStatus: jest.fn(),
        getPlan: jest.fn(),
        apply: jest.fn(),
        undo: jest.fn(),
        verify: jest.fn(),
      };

      registerSshAgentSetupIpcHandlers(service);
      await handlers.get(SSH_AGENT_SETUP_IPC_CHANNELS.APPLY)!(
        {},
        "plan",
        ["ssh-config"],
        "/etc/passwd",
        "evil content",
      );
      await handlers.get(SSH_AGENT_SETUP_IPC_CHANNELS.UNDO)!({}, "/etc/passwd");
      await handlers.get(SSH_AGENT_SETUP_IPC_CHANNELS.GET_PLAN)!({}, { path: "/etc" });
      await handlers.get(SSH_AGENT_SETUP_IPC_CHANNELS.VERIFY)!({}, ["/bin/sh", "-c", "id"]);

      expect([...handlers.keys()].sort()).toEqual(
        Object.values(SSH_AGENT_SETUP_IPC_CHANNELS).sort(),
      );
      expect(service.apply).toHaveBeenCalledWith("plan", ["ssh-config"]);
      expect(service.undo).toHaveBeenCalledWith();
      expect(service.getPlan).toHaveBeenCalledWith();
      expect(service.verify).toHaveBeenCalledWith();
    });

    it("cannot be steered to write renderer-supplied paths, content or argv", async () => {
      const outside = path.join(root, "outside");
      await fs.mkdir(outside);
      await fs.writeFile(path.join(outside, "victim"), "original\n");
      const deps = makeDeps();
      const service = new SshAgentSetupService(deps);
      const plan = await service.getPlan();
      // Long absolute paths are rejected before any work happens.
      await expect(
        service.apply(plan.planId, ["ssh-config", path.join(outside, "victim")]),
      ).rejects.toThrow();
      const payloads = [
        "/etc/passwd",
        "../../outside/victim",
        "$(touch /tmp/pwned)",
        "ssh-config\nInclude /etc/passwd",
      ];

      const results = await service.apply(plan.planId, ["ssh-config", ...payloads]);

      expect(results.map((r) => [r.stepId, r.status, r.errorCode])).toEqual([
        ["ssh-config", SshAgentSetupStepStatus.Applied, undefined],
        ...payloads.map((p) => [p, SshAgentSetupStepStatus.Failed, "unknown"]),
      ]);
      expect(await snapshot(outside)).toEqual({ victim: "original\n" });
      const written = await snapshot(home);
      expect(Object.keys(written).sort()).toEqual([".ssh/bitwarden/agent.conf", ".ssh/config"]);
      for (const content of Object.values(written)) {
        for (const p of payloads) {
          expect(content).not.toContain(p);
        }
      }
      expect(deps.execFile).not.toHaveBeenCalled();
    });

    it("rejects malformed requests", async () => {
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();

      await expect(service.apply(42, ["ssh-config"])).rejects.toThrow();
      await expect(service.apply(plan.planId, "ssh-config")).rejects.toThrow();
      await expect(service.apply(plan.planId, [{ path: "/etc" }])).rejects.toThrow();
      await expect(service.apply(plan.planId, ["x".repeat(65)])).rejects.toThrow();
      await expect(service.apply(plan.planId, new Array(11).fill("ssh-config"))).rejects.toThrow();
      expect(await snapshot(home)).toEqual({});
    });

    it("rejects unknown and stale plan ids without writing", async () => {
      const service = new SshAgentSetupService(makeDeps());
      const stale = await service.getPlan();
      await service.getPlan();

      const unknown = await service.apply("not-a-plan", ["ssh-config"]);
      const old = await service.apply(stale.planId, ["ssh-config"]);

      expect(unknown).toEqual([
        { stepId: "ssh-config", status: "failed", errorCode: "plan-expired" },
      ]);
      expect(old).toEqual(unknown);
      expect(await snapshot(home)).toEqual({});
    });

    it("treats a plan as single use", async () => {
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();
      await service.apply(plan.planId, ["ssh-config"]);

      const again = await service.apply(plan.planId, ["shell-zsh"]);

      expect(again[0].errorCode).toBe("plan-expired");
      expect(await exists(path.join(home, ".zshrc"))).toBe(false);
    });

    it("aborts a step with changed-since-preview when the file changed after preview", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".ssh/config"), "Host a\n", { mode: 0o600 });
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();
      await fs.writeFile(path.join(home, ".ssh/config"), "Host a\nHost b\n");

      const results = await service.apply(plan.planId, ["ssh-config", "shell-zsh"]);

      expect(results).toEqual([
        {
          stepId: "ssh-config",
          status: "failed",
          errorCode: "changed-since-preview",
          displayPath: "~/.ssh/config",
        },
        { stepId: "shell-zsh", status: "applied", displayPath: "~/.zshrc" },
      ]);
      expect(await readText(path.join(home, ".ssh/config"))).toBe("Host a\nHost b\n");
      expect(await exists(path.join(home, ".ssh/bitwarden"))).toBe(false);
    });

    it("treats a file created after preview as changed-since-preview", async () => {
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();
      await fs.writeFile(path.join(home, ".zshrc"), "echo hi\n");

      const results = await service.apply(plan.planId, ["shell-zsh"]);

      expect(results[0].errorCode).toBe("changed-since-preview");
      expect(await readText(path.join(home, ".zshrc"))).toBe("echo hi\n");
    });
  });

  describe("blocked steps and write failures", () => {
    it("offers the lines to add by hand for a blocked ssh config", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(root, "real-config"), "Host *\n");
      await fs.symlink(path.join(root, "real-config"), path.join(home, ".ssh/config"));
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      expect(plan.steps[0].status).toBe(SshAgentSetupStepStatus.Blocked);
      expect(plan.steps[0].addedLines).toEqual([
        "Host *",
        '  IdentityAgent "~/.bitwarden-ssh-agent.sock"',
      ]);
    });

    it("offers the profile block for a blocked shell profile", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), `${MANAGED_BLOCK_BEGIN}\nedited\n`);
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      const zsh = plan.steps.find((s) => s.id === "shell-zsh")!;
      expect(zsh.status).toBe(SshAgentSetupStepStatus.Blocked);
      expect(zsh.blockedReasonKey).toBe(SshAgentSetupBlockedReason.ManagedBlockModified);
      expect(zsh.addedLines).toEqual([
        MANAGED_BLOCK_BEGIN,
        `if [ -z "\${SSH_CONNECTION:-}" ]; then export SSH_AUTH_SOCK='${socket}'; fi`,
        MANAGED_BLOCK_END,
      ]);
    });

    it("offers the drop-in lines for a blocked fish drop-in", async () => {
      await fs.mkdir(path.join(home, ".config/fish/conf.d"), { recursive: true, mode: 0o700 });
      await fs.writeFile(
        path.join(home, ".config/fish/conf.d/bitwarden-ssh-agent.fish"),
        "not ours\n",
      );
      const service = new SshAgentSetupService(makeDeps({ loginShell: "fish" }));

      const plan = await service.getPlan();

      const fish = plan.steps.find((s) => s.id === "shell-fish")!;
      expect(fish.status).toBe(SshAgentSetupStepStatus.Blocked);
      expect(fish.addedLines).toContain(`    set -gx SSH_AUTH_SOCK '${socket}'`);
    });

    it("sends no lines to add when the agent address is not safe to write", async () => {
      const deps = makeDeps();
      jest.mocked(deps.native.getSocketAddress).mockReturnValue(`${socket}'; rm -rf ~; '`);
      const service = new SshAgentSetupService(deps);

      const plan = await service.getPlan();

      expect(plan.steps.every((s) => s.status === SshAgentSetupStepStatus.Blocked)).toBe(true);
      expect(plan.steps.every((s) => s.addedLines.length === 0)).toBe(true);
    });

    it("reports the path and reason for a step that is blocked when applied", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".ssh/config"), "Host a\n", { mode: 0o600 });
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();
      await fs.rm(path.join(home, ".ssh/config"));
      await fs.writeFile(path.join(root, "real-config"), "Host a\n");
      await fs.symlink(path.join(root, "real-config"), path.join(home, ".ssh/config"));

      const [result] = await service.apply(plan.planId, ["ssh-config"]);

      expect(result).toEqual({
        stepId: "ssh-config",
        status: "blocked",
        errorCode: "blocked",
        displayPath: "~/.ssh/config",
        blockedReasonKey: SshAgentSetupBlockedReason.Symlink,
      });
    });

    it.each([
      ["EROFS", "read-only"],
      ["ENOSPC", "no-space"],
      ["EDQUOT", "no-space"],
      ["EACCES", "permission"],
      ["EPERM", "permission"],
      ["EIO", "other"],
    ])("classifies a %s write error as %s without leaking the message", async (code, expected) => {
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();
      const rename = jest
        .spyOn(fs, "rename")
        .mockRejectedValue(Object.assign(new Error(`${home} secret`), { code }));

      let results;
      try {
        results = await service.apply(plan.planId, ["shell-zsh"]);
      } finally {
        rename.mockRestore();
      }

      expect(results).toEqual([
        {
          stepId: "shell-zsh",
          status: "failed",
          errorCode: "write-failed",
          displayPath: "~/.zshrc",
          writeErrorClass: expected,
        },
      ]);
      expect(JSON.stringify(results)).not.toContain("secret");
    });

    it("classifies an error without a code as other", async () => {
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();
      const rename = jest.spyOn(fs, "rename").mockRejectedValue(new Error("boom"));

      let results;
      try {
        results = await service.apply(plan.planId, ["shell-zsh"]);
      } finally {
        rename.mockRestore();
      }

      expect(results?.[0].writeErrorClass).toBe("other");
    });

    it("keeps an unknown step id in a valid plan as unknown, not plan-expired", async () => {
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();

      const results = await service.apply(plan.planId, ["nope"]);

      expect(results).toEqual([{ stepId: "nope", status: "failed", errorCode: "unknown" }]);
    });
  });

  describe("socket path injection (requirement 3)", () => {
    it.each([
      ["command substitution", "/tmp/$(touch pwned)/agent.sock"],
      ["backticks", "/tmp/`id`/agent.sock"],
      ["single quote", "/tmp/a'b/agent.sock"],
      ["double quote", '/tmp/a"b/agent.sock'],
      ["newline", "/tmp/a\nInclude /etc/passwd"],
      ["carriage return", "/tmp/a\rb.sock"],
      ["space", "/tmp/a b/agent.sock"],
      ["semicolon", "/tmp/a;rm -rf ~"],
      ["percent token", "/tmp/%d/agent.sock"],
      ["tilde", "~/agent.sock"],
      ["relative", "agent.sock"],
      ["unicode", "/tmp/‮agent.sock"],
    ])("blocks every step for %s and writes nothing", async (_name, payload) => {
      socket = payload;
      await fs.writeFile(path.join(home, ".zshrc"), "# rc\n");
      const service = new SshAgentSetupService(makeDeps());

      const { plan, results } = await applyAll(service);

      expect(plan.steps.map((s) => [s.status, s.blockedReasonKey, s.addedLines])).toEqual([
        [SshAgentSetupStepStatus.Blocked, SshAgentSetupBlockedReason.UnsafeSocketPath, []],
        [SshAgentSetupStepStatus.Blocked, SshAgentSetupBlockedReason.UnsafeSocketPath, []],
      ]);
      expect(plan.guidedCommands).toEqual([]);
      expect(results.every((r) => r.errorCode === "blocked")).toBe(true);
      expect(await snapshot(home)).toEqual({ ".zshrc": "# rc\n" });
    });

    it("blocks with a distinct reason when the agent has no socket address", async () => {
      const service = new SshAgentSetupService(
        makeDeps({ native: { getSocketAddress: () => null, probeAddress: async () => false } }),
      );

      const plan = await service.getPlan();

      expect(plan.steps.map((s) => s.blockedReasonKey)).toEqual([
        SshAgentSetupBlockedReason.NoSocketAddress,
        SshAgentSetupBlockedReason.NoSocketAddress,
      ]);
    });
  });

  describe("safety checks (requirement 4)", () => {
    it("blocks a symlinked ~/.ssh/config", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(root, "real-config"), "Host *\n");
      await fs.symlink(path.join(root, "real-config"), path.join(home, ".ssh/config"));
      const service = new SshAgentSetupService(makeDeps());

      const { plan, results } = await applyAll(service);

      expect(plan.steps[0]).toMatchObject({
        id: "ssh-config",
        status: SshAgentSetupStepStatus.Blocked,
        blockedReasonKey: SshAgentSetupBlockedReason.Symlink,
        displayPath: "~/.ssh/config",
      });
      expect(results[0]).toEqual({
        stepId: "ssh-config",
        status: "blocked",
        errorCode: "blocked",
        displayPath: "~/.ssh/config",
        blockedReasonKey: SshAgentSetupBlockedReason.Symlink,
      });
      expect(await readText(path.join(root, "real-config"))).toBe("Host *\n");
    });

    it("blocks a symlinked ~/.ssh directory", async () => {
      await fs.mkdir(path.join(root, "elsewhere"), { mode: 0o700 });
      await fs.symlink(path.join(root, "elsewhere"), path.join(home, ".ssh"));
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      expect(plan.steps[0].blockedReasonKey).toBe(SshAgentSetupBlockedReason.Symlink);
    });

    it("blocks a symlink swapped in between preview and apply", async () => {
      const service = new SshAgentSetupService(makeDeps());
      const plan = await service.getPlan();
      await fs.writeFile(path.join(root, "target"), "");
      await fs.symlink(path.join(root, "target"), path.join(home, ".zshrc"));

      const results = await service.apply(plan.planId, ["shell-zsh"]);

      expect(results[0].errorCode).toBe("blocked");
      expect(await readText(path.join(root, "target"))).toBe("");
    });

    it.each([
      ["group-writable file", ".ssh/config", 0o620],
      ["world-writable file", ".ssh/config", 0o606],
      ["group-writable directory", ".ssh", 0o770],
    ])("blocks a %s", async (_name, rel, badMode) => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".ssh/config"), "", { mode: 0o600 });
      await fs.chmod(path.join(home, rel), badMode);
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      expect(plan.steps[0].blockedReasonKey).toBe(SshAgentSetupBlockedReason.Permissions);
    });

    it("blocks files that are not owned by the current user", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), "");
      const service = new SshAgentSetupService(makeDeps({ uid: uid + 1 }));

      const plan = await service.getPlan();

      expect(plan.steps.map((s) => s.blockedReasonKey)).toEqual([
        SshAgentSetupBlockedReason.Owner,
        SshAgentSetupBlockedReason.Owner,
      ]);
    });

    it("blocks hard-linked files", async () => {
      await fs.writeFile(path.join(root, "shared"), "");
      await fs.link(path.join(root, "shared"), path.join(home, ".zshrc"));
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      expect(plan.steps[1].blockedReasonKey).toBe(SshAgentSetupBlockedReason.NotRegularFile);
    });

    it("blocks targets that resolve outside the home directory", async () => {
      const service = new SshAgentSetupService(
        makeDeps({ homeOverridden: false, env: { ZDOTDIR: path.join(root, "zdot") } }),
      );

      const plan = await service.getPlan();

      expect(plan.steps[1].blockedReasonKey).toBe(SshAgentSetupBlockedReason.OutsideHome);
    });

    it("keeps at most three 0600 backups of a user-owned file", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), "original\n", { mode: 0o644 });
      let tick = 0;
      const service = new SshAgentSetupService(
        makeDeps({ now: () => new Date(FIXED_NOW.getTime() + tick++ * 1000) }),
      );

      for (let i = 0; i < 4; i++) {
        await applyAll(service);
        await service.undo();
      }

      const backups = (await fs.readdir(home)).filter((n) => n.startsWith(".zshrc.bitwarden-"));
      expect(backups).toHaveLength(3);
      for (const b of backups) {
        expect(await mode(path.join(home, b))).toBe(0o600);
      }
      expect(await readText(path.join(home, ".zshrc"))).toBe("original\n");
    });
  });

  describe("conflict detection (requirement 5)", () => {
    it("marks an existing IdentityAgent as a conflict and leaves it alone by default", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      const config =
        "Host github.com\n  User git\n\nHost *\n  IdentityAgent ~/.1password/agent.sock\n";
      await fs.writeFile(path.join(home, ".ssh/config"), config, { mode: 0o600 });
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();
      await service.apply(plan.planId, ["shell-zsh"]);

      expect(plan.steps[0]).toMatchObject({
        status: SshAgentSetupStepStatus.Conflict,
        conflict: { existingLine: "IdentityAgent ~/.1password/agent.sock", lineNumber: 5 },
      });
      expect(await readText(path.join(home, ".ssh/config"))).toBe(config);
      expect(await service.getStatus()).toBe(SshAgentSetupOverallStatus.Partial);
    });

    it("applies a conflict step only when the user explicitly selects it", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".ssh/config"), "IdentityAgent /x\n", { mode: 0o600 });
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();
      const results = await service.apply(plan.planId, ["ssh-config"]);

      expect(results[0].status).toBe(SshAgentSetupStepStatus.Applied);
      expect(await readText(path.join(home, ".ssh/config"))).toMatch(
        new RegExp(`^${escapeRegExp(MANAGED_BLOCK_BEGIN)}[\\s\\S]*IdentityAgent /x\\n$`),
      );
    });

    it("strips control characters and truncates the conflicting line", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      const longLine = `IdentityAgent /a\u001b[31m‮${"b".repeat(200)}`;
      await fs.writeFile(path.join(home, ".ssh/config"), `${longLine}\r\n`, { mode: 0o600 });
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      const shown = plan.steps[0].conflict!.existingLine;
      expect(shown).toHaveLength(120);
      expect(shown).toBe(`IdentityAgent /a[31m${"b".repeat(200)}`.slice(0, 120));
      expect(shown.startsWith("IdentityAgent /a[31m")).toBe(true);
    });

    it("treats a manual IdentityAgent pointing at Bitwarden as already configured", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(
        path.join(home, ".ssh/config"),
        "Host *\n  IdentityAgent ~/.bitwarden-ssh-agent.sock\n",
        { mode: 0o600 },
      );
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      expect(plan.steps[0].status).toBe(SshAgentSetupStepStatus.AlreadyConfigured);
    });

    it("marks an existing SSH_AUTH_SOCK export in the profile as a conflict", async () => {
      await fs.writeFile(
        path.join(home, ".zshrc"),
        "# comment SSH_AUTH_SOCK\nexport SSH_AUTH_SOCK=$HOME/.gnupg/S.gpg-agent.ssh\n",
      );
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      expect(plan.steps[1]).toMatchObject({
        status: SshAgentSetupStepStatus.Conflict,
        conflict: {
          existingLine: "export SSH_AUTH_SOCK=$HOME/.gnupg/S.gpg-agent.ssh",
          lineNumber: 2,
        },
      });
    });

    it("marks eval'd agents in the profile as a conflict", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), 'eval "$(ssh-agent -s)"\n');
      const service = new SshAgentSetupService(makeDeps());

      const plan = await service.getPlan();

      expect(plan.steps[1].conflict).toEqual({
        existingLine: 'eval "$(ssh-agent -s)"',
        lineNumber: 1,
      });
    });

    it("marks a set SSH_AUTH_SOCK in config.fish as a conflict for fish users", async () => {
      await fs.mkdir(path.join(home, ".config/fish"), { recursive: true, mode: 0o700 });
      await fs.writeFile(
        path.join(home, ".config/fish/config.fish"),
        "set -gx SSH_AUTH_SOCK ~/.1password/agent.sock\n",
      );
      const service = new SshAgentSetupService(makeDeps({ loginShell: "fish" }));

      const plan = await service.getPlan();

      expect(plan.steps[1].status).toBe(SshAgentSetupStepStatus.Conflict);
      expect(plan.steps[1].conflict?.lineNumber).toBe(1);
    });

    it("marks the process SSH_AUTH_SOCK as a conflict unless it is the macOS launchd default", async () => {
      const other = new SshAgentSetupService(
        makeDeps({ env: { SSH_AUTH_SOCK: "/run/user/1000/keyring/ssh" } }),
      );
      const launchd = new SshAgentSetupService(
        makeDeps({
          env: { SSH_AUTH_SOCK: "/private/tmp/com.apple.launchd.AbC123/Listeners" },
        }),
      );

      expect((await other.getPlan()).steps[1]).toMatchObject({
        status: SshAgentSetupStepStatus.Conflict,
        conflict: { existingLine: "SSH_AUTH_SOCK=/run/user/1000/keyring/ssh", lineNumber: 0 },
      });
      expect((await other.getPlan()).steps[0].status).toBe(SshAgentSetupStepStatus.Pending);
      expect((await launchd.getPlan()).steps[1].status).toBe(SshAgentSetupStepStatus.Pending);
    });

    it("reports other agents by display name from well-known paths only and never modifies them", async () => {
      await fs.mkdir(path.join(home, ".1password"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".1password/agent.sock"), "");
      await fs.mkdir(path.join(root, "run/gnupg"), { recursive: true });
      await fs.writeFile(path.join(root, "run/gnupg/S.gpg-agent.ssh"), "");
      await fs.mkdir(path.join(home, ".keychain"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".keychain/testhost-sh"), "SSH_AUTH_SOCK=x");
      const before = await snapshot(root);
      const service = new SshAgentSetupService(makeDeps());

      const env = await service.getEnvironment();

      expect(env.otherAgents).toEqual(["1Password", "GnuPG agent", "keychain"]);
      expect(await snapshot(root)).toEqual(before);
    });
  });

  describe("undo (requirement 6)", () => {
    it("removes exactly the marked blocks and app-owned files and keeps later user edits", async () => {
      await fs.mkdir(path.join(home, ".ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(home, ".ssh/config"), "Host a\n  User x\n", { mode: 0o600 });
      await fs.writeFile(path.join(home, ".zshrc"), "export A=1\n");
      const service = new SshAgentSetupService(makeDeps());
      await applyAll(service);
      // User edits after apply, above and below our blocks.
      await fs.writeFile(
        path.join(home, ".ssh/config"),
        `# mine\n${await readText(path.join(home, ".ssh/config"))}Host b\n  User y\n`,
      );
      await fs.appendFile(path.join(home, ".zshrc"), "export B=2\n");

      const results = await service.undo();

      expect(results).toEqual([
        { stepId: "ssh-config", status: "applied" },
        { stepId: "shell-zsh", status: "applied" },
      ]);
      expect(await readText(path.join(home, ".ssh/config"))).toBe(
        "# mine\nHost a\n  User x\nHost b\n  User y\n",
      );
      expect(await readText(path.join(home, ".zshrc"))).toBe("export A=1\nexport B=2\n");
      expect(await exists(path.join(home, ".ssh/bitwarden"))).toBe(false);
      expect(await service.getStatus()).toBe(SshAgentSetupOverallStatus.NotConfigured);
    });

    it("leaves an edited block in place and reports changed-since-preview", async () => {
      const service = new SshAgentSetupService(makeDeps());
      await applyAll(service);
      const rc = path.join(home, ".zshrc");
      const edited = (await readText(rc)).replace(
        "export SSH_AUTH_SOCK=",
        "export SSH_AUTH_SOCK2=",
      );
      await fs.writeFile(rc, edited);

      const results = await service.undo();

      expect(results).toContainEqual({
        stepId: "shell-zsh",
        status: "failed",
        errorCode: "changed-since-preview",
      });
      expect(await readText(rc)).toBe(edited);
      expect(results).toContainEqual({ stepId: "ssh-config", status: "applied" });
    });

    it("leaves an edited app-owned include file in place", async () => {
      const service = new SshAgentSetupService(makeDeps());
      await applyAll(service);
      const agentConf = path.join(home, ".ssh/bitwarden/agent.conf");
      await fs.appendFile(agentConf, "  ForwardAgent yes\n");
      const config = await readText(path.join(home, ".ssh/config"));

      const results = await service.undo();

      expect(results[0]).toEqual({
        stepId: "ssh-config",
        status: "failed",
        errorCode: "changed-since-preview",
      });
      expect(await readText(path.join(home, ".ssh/config"))).toBe(config);
      expect(await exists(agentConf)).toBe(true);
    });

    it("removes the fish drop-in", async () => {
      const service = new SshAgentSetupService(makeDeps({ loginShell: "fish" }));
      await applyAll(service);

      const results = await service.undo();

      expect(results.map((r) => r.stepId)).toEqual(["ssh-config", "shell-fish"]);
      expect(await exists(path.join(home, ".config/fish/conf.d/bitwarden-ssh-agent.fish"))).toBe(
        false,
      );
    });

    it("returns no results when nothing was configured", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), "export A=1\n");
      const service = new SshAgentSetupService(makeDeps());

      expect(await service.undo()).toEqual([]);
      expect(await snapshot(home)).toEqual({ ".zshrc": "export A=1\n" });
    });
  });

  describe("modes (requirement 7)", () => {
    it.each([
      [
        SshAgentSetupPlatform.Mac,
        SshAgentSetupPackaging.MacAppStore,
        "sshAgentSetupGuidedReasonMas",
      ],
      [SshAgentSetupPlatform.Linux, SshAgentSetupPackaging.Snap, "sshAgentSetupGuidedReasonSnap"],
      [
        SshAgentSetupPlatform.Linux,
        SshAgentSetupPackaging.Flatpak,
        "sshAgentSetupGuidedReasonFlatpak",
      ],
    ])(
      "is guided on %s/%s with the export line for the bound socket",
      async (platform, packaging, reason) => {
        socket = "/home/u/snap/bitwarden/123/.bitwarden-ssh-agent.sock";
        const service = new SshAgentSetupService(makeDeps({ platform, packaging }));

        const env = await service.getEnvironment();
        const plan = await service.getPlan();
        const results = await service.apply(plan.planId, ["ssh-config", "shell-zsh"]);

        expect(env).toMatchObject({ mode: SshAgentSetupMode.Guided, guidedReasonKey: reason });
        expect(plan.steps).toEqual([]);
        expect(plan.guidedCommands).toEqual([
          {
            id: "posix-export",
            command: `export SSH_AUTH_SOCK='${socket}'`,
            descriptionKey: "sshAgentSetupGuidedCommandPosixExport",
          },
          {
            id: "fish-export",
            command: `set -gx SSH_AUTH_SOCK '${socket}'`,
            descriptionKey: "sshAgentSetupGuidedCommandFishExport",
          },
        ]);
        expect(results.every((r) => r.errorCode === "unknown")).toBe(true);
        expect(await service.undo()).toEqual([]);
        expect(await service.getStatus()).toBe(SshAgentSetupOverallStatus.Unsupported);
        expect(await snapshot(home)).toEqual({});
      },
    );

    it.each([
      [SshAgentSetupPackaging.Standard, "sshAgentSetupGuidedReasonWindows"],
      [SshAgentSetupPackaging.WindowsStore, "sshAgentSetupGuidedReasonWindowsStore"],
    ])("shows (never runs) the PowerShell command on Windows %s", async (packaging, reason) => {
      socket = "\\\\.\\pipe\\openssh-ssh-agent";
      const deps = makeDeps({ platform: SshAgentSetupPlatform.Windows, packaging });
      const service = new SshAgentSetupService(deps);

      const env = await service.getEnvironment();
      const plan = await service.getPlan();

      expect(env).toMatchObject({ mode: SshAgentSetupMode.Guided, guidedReasonKey: reason });
      expect(plan.steps).toEqual([]);
      expect(plan.guidedCommands).toEqual([
        {
          id: "windows-disable-openssh-agent",
          command:
            "Get-Service ssh-agent | Stop-Service -PassThru | Set-Service -StartupType Disabled",
          descriptionKey: "sshAgentSetupGuidedCommandWindowsDisableOpenSshAgent",
        },
      ]);
      expect(deps.execFile).not.toHaveBeenCalled();
    });

    it("omits guided export commands when the bound socket path is unsafe", async () => {
      socket = "/tmp/it's here";
      const service = new SshAgentSetupService(
        makeDeps({ packaging: SshAgentSetupPackaging.Flatpak }),
      );

      expect((await service.getPlan()).guidedCommands).toEqual([]);
    });

    it("is automatic on macOS and Linux standard packages", async () => {
      for (const platform of [SshAgentSetupPlatform.Mac, SshAgentSetupPlatform.Linux]) {
        const env = await new SshAgentSetupService(makeDeps({ platform })).getEnvironment();
        expect(env.mode).toBe(SshAgentSetupMode.Automatic);
        expect(env.guidedReasonKey).toBeUndefined();
      }
    });
  });

  describe("verify (requirement 8)", () => {
    it("checks the agent with probeAddress on the bound address", async () => {
      const deps = makeDeps();
      jest.mocked(deps.native.probeAddress).mockResolvedValueOnce(false);
      const service = new SshAgentSetupService(deps);

      expect((await service.verify()).agent).toBe(SshAgentVerifyOutcome.Unreachable);
      expect((await service.verify()).agent).toBe(SshAgentVerifyOutcome.Ok);
      expect(deps.native.probeAddress).toHaveBeenCalledWith(socket);
    });

    it("runs ssh -G with an allowlisted absolute binary, argv array, minimal env, app-owned cwd and timeout", async () => {
      const calls: { file: string; args: readonly string[]; options: ExecFileOptions }[] = [];
      const deps = makeDeps({
        execFile: async (file, args, options) => {
          calls.push({ file, args, options });
          // cwd must exist while ssh runs and must not be inside the home directory.
          expect((await fs.stat(options.cwd)).isDirectory()).toBe(true);
          return { stdout: `user me\nidentityagent ${socket}\n` };
        },
      });
      const service = new SshAgentSetupService(deps);

      const result = await service.verify();

      expect(result.sshClient).toBe(SshAgentVerifyOutcome.Ok);
      expect(calls).toHaveLength(1);
      const [{ file, args, options }] = calls;
      expect(file).toBe(process.execPath);
      expect(args).toEqual(["-G", "-F", path.join(home, ".ssh/config"), "example.com"]);
      expect(options).toMatchObject({ timeout: 5000, shell: false, windowsHide: true });
      expect(Object.keys(options.env).sort()).toEqual(["HOME", "LANG", "PATH"]);
      expect(options.env.HOME).toBe(home);
      expect(options.cwd.startsWith(os.tmpdir())).toBe(true);
      expect(options.cwd.startsWith(home)).toBe(false);
      expect(await exists(options.cwd)).toBe(false);
    });

    it("does not pass -F outside dev/test home overrides", async () => {
      const execFile = jest.fn<ReturnType<ExecFileFn>, Parameters<ExecFileFn>>(async () => ({
        stdout: "",
      }));
      const service = new SshAgentSetupService(makeDeps({ homeOverridden: false, execFile }));

      await service.verify();

      expect(execFile.mock.calls[0][1]).toEqual(["-G", "example.com"]);
    });

    it("reports other-agent when ssh -G resolves a different IdentityAgent", async () => {
      const service = new SshAgentSetupService(
        makeDeps({ execFile: async () => ({ stdout: "identityagent /other/agent.sock\n" }) }),
      );

      expect((await service.verify()).sshClient).toBe(SshAgentVerifyOutcome.OtherAgent);
    });

    it("reports not-checked when no allowlisted ssh binary exists or ssh fails", async () => {
      const missing = new SshAgentSetupService(
        makeDeps({ sshBinaries: [path.join(root, "no-ssh")] }),
      );
      const failing = new SshAgentSetupService(
        makeDeps({ execFile: async () => Promise.reject(new Error("timeout")) }),
      );
      const relative = new SshAgentSetupService(makeDeps({ sshBinaries: ["ssh"] }));

      expect((await missing.verify()).sshClient).toBe(SshAgentVerifyOutcome.NotChecked);
      expect((await failing.verify()).sshClient).toBe(SshAgentVerifyOutcome.NotChecked);
      expect((await relative.verify()).sshClient).toBe(SshAgentVerifyOutcome.NotChecked);
    });

    it("inspects the shell profile statically: not-configured, ok, then other-agent after a later export", async () => {
      const service = new SshAgentSetupService(makeDeps());
      expect((await service.verify()).shell).toBe(SshAgentVerifyOutcome.NotConfigured);

      await applyAll(service);
      const ok = await service.verify();
      expect(ok.shell).toBe(SshAgentVerifyOutcome.Ok);
      expect(ok.details?.overrideFile).toBeUndefined();

      await fs.appendFile(path.join(home, ".zshrc"), "export SSH_AUTH_SOCK=/other\n");
      const overridden = await service.verify();
      expect(overridden.shell).toBe(SshAgentVerifyOutcome.OtherAgent);
      expect(overridden.details).toMatchObject({ overrideFile: "~/.zshrc", overrideLine: 4 });
    });

    it("reports not-configured, not other-agent, when the profile has another export but no Bitwarden block", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), "export SSH_AUTH_SOCK=/other\n");
      const service = new SshAgentSetupService(makeDeps());

      const result = await service.verify();

      expect(result.shell).toBe(SshAgentVerifyOutcome.NotConfigured);
      expect(result.details?.overrideFile).toBeUndefined();
    });

    it("reports not-configured for ssh when there is no IdentityAgent and new terminals are not set up", async () => {
      const service = new SshAgentSetupService(makeDeps());

      const result = await service.verify();

      expect(result.sshClient).toBe(SshAgentVerifyOutcome.NotConfigured);
      expect(result.details?.identityAgent).toBeUndefined();
    });

    it("keeps ssh other-agent when the terminal is set up but a later export replaces it", async () => {
      const service = new SshAgentSetupService(makeDeps());
      await applyAll(service);
      await fs.appendFile(path.join(home, ".zshrc"), "export SSH_AUTH_SOCK=/other\n");

      expect((await service.verify()).sshClient).toBe(SshAgentVerifyOutcome.OtherAgent);
    });

    it("returns the other IdentityAgent as a home-relative display value", async () => {
      const inHome = new SshAgentSetupService(
        makeDeps({
          execFile: async () => ({
            stdout: `identityagent ${path.join(home, ".other/agent.sock")}\n`,
          }),
        }),
      );
      const outside = new SshAgentSetupService(
        makeDeps({ execFile: async () => ({ stdout: "identityagent /run/other.sock\n" }) }),
      );

      expect((await inHome.verify()).details?.identityAgent).toBe("~/.other/agent.sock");
      expect((await outside.verify()).details?.identityAgent).toBe("/run/other.sock");
    });

    it("never puts the absolute home directory in verify details", async () => {
      const service = new SshAgentSetupService(
        makeDeps({
          execFile: async () => ({ stdout: `identityagent ${path.join(home, ".other.sock")}\n` }),
        }),
      );
      await applyAll(service);
      await fs.appendFile(path.join(home, ".zshrc"), "export SSH_AUTH_SOCK=/other\n");

      expect(JSON.stringify((await service.verify()).details)).not.toContain(home);
    });

    it("reports a switched-off agent as not-checked without probing", async () => {
      const deps = makeDeps({
        agentState: {
          isRunning: () => false,
          isEnabled: () => false,
          startErrorCode: () => undefined,
        },
      });
      const service = new SshAgentSetupService(deps);

      expect((await service.verify()).agent).toBe(SshAgentVerifyOutcome.NotChecked);
      expect(deps.native.probeAddress).not.toHaveBeenCalled();
    });

    it("reports an enabled agent that does not answer as unreachable, including after a failed start", async () => {
      const deps = makeDeps({
        agentState: {
          isRunning: () => false,
          isEnabled: () => true,
          startErrorCode: () => "address-in-use",
        },
      });
      jest.mocked(deps.native.probeAddress).mockResolvedValue(false);
      const service = new SshAgentSetupService(deps);

      const result = await service.verify();

      expect(result.agent).toBe(SshAgentVerifyOutcome.Unreachable);
      expect(result.details?.socketAddress).toBe("~/.bitwarden-ssh-agent.sock");
    });

    it("reports unreachable when the agent has no address", async () => {
      const deps = makeDeps();
      jest.mocked(deps.native.getSocketAddress).mockReturnValue(null);
      const result = await new SshAgentSetupService(deps).verify();

      expect(result.agent).toBe(SshAgentVerifyOutcome.Unreachable);
      expect(result.details?.socketAddress).toBeUndefined();
    });

    it("flags other-agent for fish when config.fish overrides the drop-in", async () => {
      const service = new SshAgentSetupService(makeDeps({ loginShell: "fish" }));
      await applyAll(service);
      expect((await service.verify()).shell).toBe(SshAgentVerifyOutcome.Ok);

      await fs.writeFile(path.join(home, ".config/fish/config.fish"), "set -x SSH_AUTH_SOCK /o\n");
      const result = await service.verify();
      expect(result.shell).toBe(SshAgentVerifyOutcome.OtherAgent);
      expect(result.details).toMatchObject({
        overrideFile: "~/.config/fish/config.fish",
        overrideLine: 1,
      });
    });

    it("skips ssh and shell checks in guided packaging", async () => {
      const deps = makeDeps({ packaging: SshAgentSetupPackaging.Snap });
      const service = new SshAgentSetupService(deps);

      expect(await service.verify()).toEqual({
        agent: SshAgentVerifyOutcome.Ok,
        sshClient: SshAgentVerifyOutcome.NotChecked,
        shell: SshAgentVerifyOutcome.NotChecked,
        details: { socketAddress: "~/.bitwarden-ssh-agent.sock" },
      });
      expect(deps.execFile).not.toHaveBeenCalled();
    });

    const realSsh = "/usr/bin/ssh";
    const itWithSsh = process.platform !== "win32" && existsSync(realSsh) ? it : it.skip;
    itWithSsh("verifies end to end with the real ssh -G against the override home", async () => {
      const { defaultExecFile } = jest.requireActual("./ssh-agent-setup-verify");
      const service = new SshAgentSetupService(
        makeDeps({ execFile: defaultExecFile, sshBinaries: [realSsh] }),
      );
      expect((await service.verify()).sshClient).not.toBe(SshAgentVerifyOutcome.Ok);

      await applyAll(service);

      expect(await service.verify()).toEqual({
        agent: SshAgentVerifyOutcome.Ok,
        sshClient: SshAgentVerifyOutcome.Ok,
        shell: SshAgentVerifyOutcome.Ok,
        details: { socketAddress: "~/.bitwarden-ssh-agent.sock" },
      });
    });
  });

  describe("status and environment (requirement 11)", () => {
    it("reports a switched-off agent as disabled without a start error", async () => {
      const service = new SshAgentSetupService(
        makeDeps({
          agentState: {
            isRunning: () => false,
            isEnabled: () => false,
            startErrorCode: () => undefined,
          },
        }),
      );

      expect(await service.getEnvironment()).toMatchObject({
        agentEnabled: false,
        agentRunning: false,
        socketAddress: null,
        intendedSocketAddress: socket,
      });
      expect((await service.getEnvironment()).startErrorCode).toBeUndefined();
    });

    it("reports the bound address while the agent runs", async () => {
      const service = new SshAgentSetupService(makeDeps());

      expect(await service.getEnvironment()).toMatchObject({
        agentEnabled: true,
        agentRunning: true,
        socketAddress: socket,
        intendedSocketAddress: socket,
      });
    });

    it("computes not-configured, partial, configured and conflict", async () => {
      const service = new SshAgentSetupService(makeDeps());
      expect(await service.getStatus()).toBe(SshAgentSetupOverallStatus.NotConfigured);

      const plan = await service.getPlan();
      await service.apply(plan.planId, ["ssh-config"]);
      expect(await service.getStatus()).toBe(SshAgentSetupOverallStatus.Partial);

      await applyAll(service);
      expect(await service.getStatus()).toBe(SshAgentSetupOverallStatus.Configured);

      const conflicted = new SshAgentSetupService(
        makeDeps({ home: path.join(root, "run"), env: { SSH_AUTH_SOCK: "/x" }, loginShell: "zsh" }),
      );
      await fs.mkdir(path.join(root, "run/.ssh"), { mode: 0o700 });
      await fs.writeFile(path.join(root, "run/.ssh/config"), "IdentityAgent /x\n", { mode: 0o600 });
      expect(await conflicted.getStatus()).toBe(SshAgentSetupOverallStatus.Conflict);
    });

    it("reports agent state, start error class and socket address", async () => {
      const service = new SshAgentSetupService(
        makeDeps({
          agentState: {
            isRunning: () => false,
            isEnabled: () => true,
            startErrorCode: () => "address-in-use",
          },
        }),
      );

      expect(await service.getEnvironment()).toEqual({
        platform: SshAgentSetupPlatform.Linux,
        packaging: SshAgentSetupPackaging.Standard,
        mode: SshAgentSetupMode.Automatic,
        socketAddress: null,
        intendedSocketAddress: socket,
        agentEnabled: true,
        agentRunning: false,
        startErrorCode: "address-in-use",
        otherAgents: [],
      });
    });
  });

  describe("logging", () => {
    it("never logs paths, socket addresses or file contents", async () => {
      await fs.writeFile(path.join(home, ".zshrc"), "export SECRET_MARKER=1\n");
      const deps = makeDeps();
      const service = new SshAgentSetupService(deps);

      await applyAll(service);
      await service.verify();
      await service.undo();
      await service.apply("bogus", ["/etc/passwd"]);

      const logged = [
        ...jest.mocked(deps.logService.info).mock.calls,
        ...jest.mocked(deps.logService.warning).mock.calls,
      ]
        .flat()
        .join("\n");
      expect(logged.length).toBeGreaterThan(0);
      expect(logged).not.toContain(root);
      expect(logged).not.toContain("SECRET_MARKER");
      expect(logged).not.toContain("/etc/passwd");
      expect(logged).not.toContain(".sock");
    });
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
