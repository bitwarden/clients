import { existsSync, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { agentConfContent, sshConfigBlockLines } from "./ssh-agent-setup-templates";
import { defaultExecFile, parseIdentityAgent } from "./ssh-agent-setup-verify";

describe("parseIdentityAgent", () => {
  it("returns the identityagent value, unquoting it", () => {
    expect(parseIdentityAgent("user a\nidentityagent /x/y.sock\n")).toBe("/x/y.sock");
    expect(parseIdentityAgent('identityagent "/x y"\r\n')).toBe("/x y");
  });

  it("returns null when ssh -G prints no identityagent line", () => {
    expect(parseIdentityAgent("user a\nhostname example.com\n")).toBeNull();
  });
});

const SSH = "/usr/bin/ssh";
const describeWithSsh = process.platform !== "win32" && existsSync(SSH) ? describe : describe.skip;

/**
 * Documents how an `Include` of `Host *` at the very top of ~/.ssh/config interacts with the
 * user's other Host blocks, using the real `ssh -G`. Runs only against temp files via `-F`.
 */
describeWithSsh("ssh -G finding: Include of Host * at the top of ~/.ssh/config", () => {
  const socket = "/tmp/bitwarden-test/.bitwarden-ssh-agent.sock";
  let dir: string;
  let config: string;

  async function resolve(host: string): Promise<Record<string, string[]>> {
    const { stdout } = await defaultExecFile(SSH, ["-G", "-F", config, host], {
      cwd: dir,
      env: { PATH: "/usr/bin:/bin", HOME: dir, LANG: "C" },
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      shell: false,
    });
    const out: Record<string, string[]> = {};
    for (const line of stdout.split("\n")) {
      const [key, ...rest] = line.split(" ");
      (out[key] ??= []).push(rest.join(" "));
    }
    return out;
  }

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "bw-ssh-g-spec-")));
    const agentConf = path.join(dir, "agent.conf");
    config = path.join(dir, "config");
    await fs.writeFile(agentConf, agentConfContent(socket), { mode: 0o600 });
    await fs.writeFile(
      config,
      [
        ...sshConfigBlockLines(agentConf),
        "User toplevel",
        "",
        "Host github.com",
        "  User git",
        "  IdentityAgent /other/agent.sock",
        "",
        "Host work",
        "  HostName work.example",
        "  IdentityFile ~/.ssh/id_work",
        "  IdentitiesOnly yes",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("applies our IdentityAgent to hosts without their own", async () => {
    expect((await resolve("example.com")).identityagent).toEqual([socket]);
  });

  it("does not change other options of other Host blocks", async () => {
    const work = await resolve("work");
    expect(work.hostname).toEqual(["work.example"]);
    expect(work.identityfile).toEqual(["~/.ssh/id_work"]);
    expect(work.identitiesonly).toEqual(["yes"]);
    // Top-level options after the Include still apply to every host.
    expect(work.user).toEqual(["toplevel"]);
  });

  it("shadows a host-specific IdentityAgent further down (first value wins), which is why any existing IdentityAgent is a conflict", async () => {
    const github = await resolve("github.com");
    expect(github.identityagent).toEqual([socket]);
    // `User toplevel` precedes `Host github.com`, so it also wins over `User git`.
    expect(github.user).toEqual(["toplevel"]);
  });
});
