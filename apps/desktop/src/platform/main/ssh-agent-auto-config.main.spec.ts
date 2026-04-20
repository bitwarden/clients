import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { LogService } from "@bitwarden/logging";

import {
  SSH_AGENT_AUTO_CONFIG_APPLY_CHANNEL,
  SSH_AGENT_AUTO_CONFIG_PREVIEW_CHANNEL,
  SshAgentAutoConfigMainService,
  SshAgentAutoConfigResult,
} from "./ssh-agent-auto-config.main";

type IpcHandler = (...args: unknown[]) => Promise<SshAgentAutoConfigResult>;
const handlers = new Map<string, IpcHandler>();

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  sshagent: {
    getSocketPath: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sshagent } = require("@bitwarden/desktop-napi") as {
  sshagent: { getSocketPath: jest.Mock<string | null> };
};

const SOCKET_PATH = "/home/fake/.bitwarden-ssh-agent.sock";

describe("SshAgentAutoConfigMainService", () => {
  let mockLogService: jest.Mocked<LogService>;
  let tmpHome: string;
  let homedirSpy: jest.SpyInstance;
  const originalPlatform = process.platform;

  const setPlatform = (value: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value, configurable: true });
  };

  beforeEach(async () => {
    handlers.clear();
    mockLogService = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as unknown as jest.Mocked<LogService>;

    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "ssh-agent-auto-config-"));
    homedirSpy = jest.spyOn(os, "homedir").mockReturnValue(tmpHome);
    setPlatform("linux");
    sshagent.getSocketPath.mockReturnValue(SOCKET_PATH);

    new SshAgentAutoConfigMainService(mockLogService);
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
    homedirSpy.mockRestore();
    setPlatform(originalPlatform);
    jest.clearAllMocks();
  });

  const apply = () => handlers.get(SSH_AGENT_AUTO_CONFIG_APPLY_CHANNEL)!();
  const preview = () => handlers.get(SSH_AGENT_AUTO_CONFIG_PREVIEW_CHANNEL)!();

  it("reports both files missing on a clean system", async () => {
    const result = await apply();

    expect(result.supported).toBe(true);
    expect(result.socketPath).toBe(SOCKET_PATH);
    expect(result.files).toEqual([
      { path: path.join(tmpHome, ".bashrc"), status: "missing" },
      { path: path.join(tmpHome, ".zshrc"), status: "missing" },
    ]);
  });

  it("appends the block to an existing file and reports written", async () => {
    await fs.writeFile(path.join(tmpHome, ".bashrc"), "alias ll='ls -al'\n");

    const result = await apply();

    const bashrc = await fs.readFile(path.join(tmpHome, ".bashrc"), "utf8");
    expect(bashrc).toContain(`export SSH_AUTH_SOCK="${SOCKET_PATH}"`);
    expect(bashrc.startsWith("alias ll='ls -al'\n")).toBe(true);
    expect(result.files[0]).toEqual({
      path: path.join(tmpHome, ".bashrc"),
      status: "written",
    });
  });

  it("prepends a newline when the file does not end with one", async () => {
    await fs.writeFile(path.join(tmpHome, ".bashrc"), "no-newline-at-end");

    await apply();

    const bashrc = await fs.readFile(path.join(tmpHome, ".bashrc"), "utf8");
    expect(bashrc).toMatch(/^no-newline-at-end\n\n/);
    expect(bashrc).toContain(`export SSH_AUTH_SOCK="${SOCKET_PATH}"`);
  });

  it("is idempotent: a second apply reports already-present and does not rewrite", async () => {
    await fs.writeFile(path.join(tmpHome, ".bashrc"), "# existing\n");
    await apply();
    const afterFirst = await fs.readFile(path.join(tmpHome, ".bashrc"), "utf8");

    const result = await apply();

    const afterSecond = await fs.readFile(path.join(tmpHome, ".bashrc"), "utf8");
    expect(afterSecond).toBe(afterFirst);
    expect(result.files[0].status).toBe("already-present");
  });

  it("flags a foreign SSH_AUTH_SOCK export as conflict and skips that file", async () => {
    const original = 'export SSH_AUTH_SOCK="/tmp/other.sock"\n';
    await fs.writeFile(path.join(tmpHome, ".bashrc"), original);
    await fs.writeFile(path.join(tmpHome, ".zshrc"), "# clean\n");

    const result = await apply();

    const bashrc = await fs.readFile(path.join(tmpHome, ".bashrc"), "utf8");
    expect(bashrc).toBe(original);
    expect(result.files[0].status).toBe("conflict");
    expect(result.files[1].status).toBe("written");
  });

  it("preview does not modify files", async () => {
    await fs.writeFile(path.join(tmpHome, ".bashrc"), "# clean\n");

    const result = await preview();

    const bashrc = await fs.readFile(path.join(tmpHome, ".bashrc"), "utf8");
    expect(bashrc).toBe("# clean\n");
    expect(result.files[0].status).toBe("written");
  });

  it("returns supported=false on Windows", async () => {
    setPlatform("win32");

    const result = await apply();

    expect(result).toEqual({ supported: false, files: [] });
  });

  it("returns supported=false when the native layer cannot produce a socket path", async () => {
    sshagent.getSocketPath.mockReturnValue(null);

    const result = await apply();

    expect(result).toEqual({ supported: false, files: [] });
  });
});
