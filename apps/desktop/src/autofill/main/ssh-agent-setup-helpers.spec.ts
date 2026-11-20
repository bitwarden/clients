import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import {
  SshAgentSetupMode,
  SshAgentSetupPackaging,
  SshAgentSetupPlatform,
} from "../models/ssh-agent-setup";

import { classifySshAgentStartError } from "./ssh-agent-native";
import {
  decideMode,
  detectLoginShell,
  resolveSetupHome,
  SSH_SETUP_HOME_OVERRIDE_ENV,
} from "./ssh-agent-setup-environment";
import { atomicWriteFile, checkPathSafety, SshAgentSetupBlockedReason } from "./ssh-agent-setup-fs";
import {
  findManagedBlocks,
  isSafeSocketPath,
  MANAGED_BLOCK_BEGIN,
  MANAGED_BLOCK_END,
  sanitizeDisplayLine,
} from "./ssh-agent-setup-templates";

jest.mock("@bitwarden/desktop-napi", () => ({ sshagent: {} }));

describe("resolveSetupHome", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("honours BITWARDEN_SSH_SETUP_HOME in tests and development", () => {
    for (const env of ["test", "development"]) {
      process.env.NODE_ENV = env;
      process.env[SSH_SETUP_HOME_OVERRIDE_ENV] = "/tmp/fake-home";
      expect(resolveSetupHome("/home/real")).toEqual({ home: "/tmp/fake-home", overridden: true });
    }
  });

  it("ignores the override in production and for relative paths", () => {
    process.env[SSH_SETUP_HOME_OVERRIDE_ENV] = "/tmp/fake-home";
    process.env.NODE_ENV = "production";
    expect(resolveSetupHome("/home/real")).toEqual({ home: "/home/real", overridden: false });

    process.env.NODE_ENV = "test";
    process.env[SSH_SETUP_HOME_OVERRIDE_ENV] = "relative/home";
    expect(resolveSetupHome("/home/real")).toEqual({ home: "/home/real", overridden: false });
  });
});

describe("decideMode", () => {
  it("is automatic only for macOS/Linux standard packages", () => {
    expect(decideMode(SshAgentSetupPlatform.Mac, SshAgentSetupPackaging.Standard).mode).toBe(
      SshAgentSetupMode.Automatic,
    );
    expect(decideMode(SshAgentSetupPlatform.Linux, SshAgentSetupPackaging.Standard).mode).toBe(
      SshAgentSetupMode.Automatic,
    );
    for (const [platform, packaging] of [
      [SshAgentSetupPlatform.Mac, SshAgentSetupPackaging.MacAppStore],
      [SshAgentSetupPlatform.Linux, SshAgentSetupPackaging.Snap],
      [SshAgentSetupPlatform.Linux, SshAgentSetupPackaging.Flatpak],
      [SshAgentSetupPlatform.Windows, SshAgentSetupPackaging.WindowsStore],
      [SshAgentSetupPlatform.Windows, SshAgentSetupPackaging.Standard],
      [null, SshAgentSetupPackaging.Standard],
    ] as const) {
      const decision = decideMode(platform, packaging);
      expect(decision.mode).toBe(SshAgentSetupMode.Guided);
      expect(decision.guidedReasonKey).toMatch(/^sshAgentSetupGuidedReason/);
    }
  });
});

describe("detectLoginShell", () => {
  it("prefers the passwd shell over $SHELL and ignores unknown shells", () => {
    expect(detectLoginShell("/bin/zsh", "/bin/bash")).toBe("zsh");
    expect(detectLoginShell(null, "/usr/local/bin/fish")).toBe("fish");
    expect(detectLoginShell("", "/bin/bash")).toBe("bash");
    expect(detectLoginShell("/bin/tcsh", "/bin/zsh")).toBeNull();
    expect(detectLoginShell(undefined, undefined)).toBeNull();
  });
});

describe("classifySshAgentStartError", () => {
  it("maps start failures to error classes only", () => {
    expect(classifySshAgentStartError(new Error("address-in-use"))).toBe("address-in-use");
    expect(classifySshAgentStartError(new Error("Address already in use (os error 48)"))).toBe(
      "address-in-use",
    );
    expect(classifySshAgentStartError({ code: "EACCES" })).toBe("permission-denied");
    expect(classifySshAgentStartError(new Error("Permission denied: /home/u/x.sock"))).toBe(
      "permission-denied",
    );
    expect(classifySshAgentStartError(new Error("boom"))).toBe("unknown");
    expect(classifySshAgentStartError(undefined)).toBe("unknown");
  });
});

describe("templates", () => {
  it("accepts only absolute paths made of safe characters", () => {
    expect(isSafeSocketPath("/Users/a/.bitwarden-ssh-agent.sock")).toBe(true);
    for (const bad of [
      null,
      "",
      "/",
      "rel/x",
      "/a b",
      "/a'b",
      "/a$(x)",
      "/a`x`",
      "/a\nb",
      "/a%d",
    ]) {
      expect(isSafeSocketPath(bad)).toBe(false);
    }
  });

  it("strips control characters and truncates to 120 characters", () => {
    expect(sanitizeDisplayLine("  a\u0007b‮c d\r")).toBe("abcd");
    expect(sanitizeDisplayLine("x".repeat(300))).toHaveLength(120);
  });

  it("flags unbalanced markers as malformed", () => {
    expect(findManagedBlocks([MANAGED_BLOCK_BEGIN, "x"]).malformed).toBe(true);
    expect(findManagedBlocks([MANAGED_BLOCK_END]).malformed).toBe(true);
    expect(
      findManagedBlocks([MANAGED_BLOCK_BEGIN, MANAGED_BLOCK_BEGIN, MANAGED_BLOCK_END]).malformed,
    ).toBe(true);
    expect(findManagedBlocks(["a", MANAGED_BLOCK_BEGIN, "x", MANAGED_BLOCK_END])).toEqual({
      blocks: [{ start: 1, end: 3 }],
      malformed: false,
    });
  });
});

describe("file-system safety", () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "bw-ssh-fs-spec-")));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it("refuses targets outside home", async () => {
    const ctx = { home, uid: process.getuid!() };
    expect(await checkPathSafety("/etc/passwd", ctx, "file")).toBe(
      SshAgentSetupBlockedReason.OutsideHome,
    );
    expect(await checkPathSafety(path.join(home, "../x"), ctx, "file")).toBe(
      SshAgentSetupBlockedReason.OutsideHome,
    );
  });

  it("atomically replaces a file with the requested mode regardless of umask", async () => {
    const target = path.join(home, "f");
    await fs.writeFile(target, "old");
    const previous = process.umask(0o077);
    try {
      await atomicWriteFile(target, "new", 0o644);
    } finally {
      process.umask(previous);
    }
    expect(await fs.readFile(target, "utf8")).toBe("new");
    expect((await fs.stat(target)).mode & 0o777).toBe(0o644);
    expect(await fs.readdir(home)).toEqual(["f"]);
  });

  it("does not follow a symlink planted at the target's temp name", async () => {
    // O_EXCL | O_NOFOLLOW means a pre-existing entry with the temp name can never be written
    // through; random names make collisions practically impossible, so only check the result.
    const target = path.join(home, "f");
    await fs.writeFile(path.join(home, "victim"), "keep");
    await fs.symlink(path.join(home, "victim"), path.join(home, ".f.bw-tmp-planted"));
    await atomicWriteFile(target, "new", 0o600);
    expect(await fs.readFile(path.join(home, "victim"), "utf8")).toBe("keep");
  });
});
