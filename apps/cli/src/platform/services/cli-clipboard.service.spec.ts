import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { StringResponse } from "../../models/response/string.response";

import { CliClipboardService } from "./cli-clipboard.service";

type Behavior =
  { kind: "exit"; code: number; stderr?: string } | { kind: "missing" } | { kind: "hang" };

class FakeChild extends EventEmitter {
  input = Buffer.alloc(0);
  killed = false;
  stdin = Object.assign(new EventEmitter(), {
    end: (data: Buffer) => {
      this.input = Buffer.concat([this.input, data]);
    },
  });
  stderr = Object.assign(new EventEmitter(), {
    destroyed: false,
    destroy() {
      this.destroyed = true;
    },
  });

  kill() {
    this.killed = true;
  }
}

function fakeSpawn(behaviors: Record<string, Behavior>) {
  const calls: { command: string; args: string[]; child: FakeChild }[] = [];
  const spawnFn = jest.fn((command: string, args: string[]) => {
    const child = new FakeChild();
    calls.push({ command, args, child });
    const behavior = behaviors[command] ?? { kind: "exit", code: 0 };
    setImmediate(() => {
      if (behavior.kind === "missing") {
        child.emit(
          "error",
          Object.assign(new Error(`spawn ${command} ENOENT`), { code: "ENOENT" }),
        );
      } else if (behavior.kind === "exit") {
        if (behavior.stderr) {
          child.stderr.emit("data", Buffer.from(behavior.stderr));
        }
        child.emit("exit", behavior.code, null);
      }
    });
    return child;
  });
  return { spawnFn, calls };
}

function service(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  behaviors: Record<string, Behavior> = {},
  timeoutMs = 5000,
) {
  const { spawnFn, calls } = fakeSpawn(behaviors);
  const sut = new CliClipboardService(platform, env, spawnFn as any, timeoutMs);
  return { sut, spawnFn, calls };
}

describe("CliClipboardService", () => {
  const secret = "p@ss wörd ✓ 🔑";

  describe("tool selection", () => {
    it("uses pbcopy on macOS", () => {
      expect(
        service("darwin", {})
          .sut.getTools()
          .map((t) => t.command),
      ).toEqual(["pbcopy"]);
    });

    it("uses clip.exe on Windows", () => {
      expect(
        service("win32", {})
          .sut.getTools()
          .map((t) => t.command),
      ).toEqual(["clip.exe"]);
    });

    it("prefers wl-copy over X11 tools when both sessions are available", () => {
      const { sut } = service("linux", { WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" });
      expect(sut.getTools().map((t) => t.command)).toEqual(["wl-copy", "xclip", "xsel"]);
    });

    it("uses xclip then xsel on X11", () => {
      const { sut } = service("linux", { DISPLAY: ":0" });
      expect(sut.getTools().map((t) => [t.command, ...t.args])).toEqual([
        ["xclip", "-selection", "clipboard"],
        ["xsel", "--clipboard", "--input"],
      ]);
    });

    it("falls back to clip.exe under WSL", () => {
      const { sut } = service("linux", { WSL_DISTRO_NAME: "Ubuntu" });
      expect(sut.getTools().map((t) => t.command)).toEqual(["clip.exe"]);
    });

    it("treats other unix platforms like Linux", () => {
      const { sut } = service("freebsd", { DISPLAY: ":0" });
      expect(sut.getTools().map((t) => t.command)).toEqual(["xclip", "xsel"]);
    });
  });

  describe("copy", () => {
    it("writes the exact value to stdin as UTF-8, without a trailing newline", async () => {
      const { sut, calls } = service("darwin", {});

      await sut.copy(secret);

      expect(calls).toHaveLength(1);
      expect(calls[0].child.input.toString("utf8")).toBe(secret);
    });

    it("never passes the value as a command line argument", async () => {
      const { sut, calls } = service("linux", { DISPLAY: ":0" });

      await sut.copy(secret);

      expect(calls[0].args.join(" ")).not.toContain(secret);
    });

    it("writes UTF-16LE with a byte order mark for clip.exe", async () => {
      const { sut, calls } = service("win32", {});

      await sut.copy(secret);

      const input = calls[0].child.input;
      expect([...input.subarray(0, 2)]).toEqual([0xff, 0xfe]);
      expect(input.subarray(2).toString("utf16le")).toBe(secret);
    });

    it("falls back to the next tool when one is not installed", async () => {
      const { sut, calls } = service("linux", { DISPLAY: ":0" }, { xclip: { kind: "missing" } });

      await sut.copy(secret);

      expect(calls.map((c) => c.command)).toEqual(["xclip", "xsel"]);
      expect(calls[1].child.input.toString("utf8")).toBe(secret);
    });

    it("falls back to the next tool when one exits with an error", async () => {
      const { sut, calls } = service(
        "linux",
        { WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" },
        { "wl-copy": { kind: "exit", code: 1, stderr: "Failed to connect to a Wayland server" } },
      );

      await sut.copy(secret);

      expect(calls.map((c) => c.command)).toEqual(["wl-copy", "xclip"]);
    });

    it("reports every tool it tried when none of them work", async () => {
      const { sut } = service(
        "linux",
        { DISPLAY: ":0" },
        {
          xclip: { kind: "exit", code: 1, stderr: "Error: Can't open display: :0\n" },
          xsel: { kind: "missing" },
        },
      );

      await expect(sut.copy(secret)).rejects.toThrow(
        "Could not copy to the clipboard. " +
          "(xclip: Error: Can't open display: :0; xsel: not installed)",
      );
    });

    it("asks to install a clipboard tool when none of them are installed", async () => {
      const { sut } = service(
        "linux",
        { DISPLAY: ":0" },
        { xclip: { kind: "missing" }, xsel: { kind: "missing" } },
      );

      await expect(sut.copy(secret)).rejects.toThrow(
        /^Could not copy to the clipboard\. Install one of: xclip, xsel\.$/,
      );
    });

    it("explains that a graphical session is needed when there is no display", async () => {
      const { sut, spawnFn } = service("linux", {});

      await expect(sut.copy(secret)).rejects.toThrow(/requires a graphical session/);
      expect(spawnFn).not.toHaveBeenCalled();
    });

    it("kills a tool that does not exit and reports a timeout", async () => {
      const { sut, calls } = service("darwin", {}, { pbcopy: { kind: "hang" } }, 10);

      await expect(sut.copy(secret)).rejects.toThrow("pbcopy: timed out after 10ms");
      expect(calls[0].child.killed).toBe(true);
    });

    it("releases stderr once the tool exits so a forked daemon cannot keep the CLI alive", async () => {
      const { sut, calls } = service("linux", { DISPLAY: ":0" });

      await sut.copy(secret);

      expect(calls[0].child.stderr.destroyed).toBe(true);
    });
  });

  describe("with a real child process", () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-clipboard-"));
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    // Stands in for the clipboard tool by running a node script with the requested stdio.
    function nodeTool(script: string) {
      return ((_command: string, _args: string[], options: any) =>
        spawn(process.execPath, ["-e", script], options)) as any;
    }

    it("delivers the value over stdin", async () => {
      const out = path.join(dir, "clipboard");
      const script = `process.stdin.pipe(require("fs").createWriteStream(${JSON.stringify(out)}));`;
      const sut = new CliClipboardService("darwin", {}, nodeTool(script));

      await sut.copy(secret);

      expect(fs.readFileSync(out, "utf8")).toBe(secret);
    });

    it("returns as soon as the tool exits even if a forked daemon keeps stderr open", async () => {
      // Like xclip and wl-copy: the tool forks a background process that inherits stderr
      // and stays alive to serve the selection, then exits itself.
      const daemon = "setTimeout(() => {}, 10000)";
      const script =
        `process.stdin.resume(); process.stdin.on("end", () => {` +
        `const c = require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(daemon)}],` +
        ` { detached: true, stdio: ["ignore", "ignore", "inherit"] }); c.unref();` +
        ` require("fs").writeFileSync(${JSON.stringify(path.join(dir, "pid"))}, String(c.pid));` +
        ` process.exit(0); });`;
      const sut = new CliClipboardService("linux", { DISPLAY: ":0" }, nodeTool(script));

      const started = Date.now();
      await sut.copy(secret);

      expect(Date.now() - started).toBeLessThan(5000);
      process.kill(Number(fs.readFileSync(path.join(dir, "pid"), "utf8")));
    });

    it("surfaces the tool's stderr when it fails", async () => {
      const script = `process.stdin.resume(); process.stderr.write("no clipboard here"); process.exitCode = 3;`;
      const sut = new CliClipboardService("darwin", {}, nodeTool(script));

      await expect(sut.copy(secret)).rejects.toThrow("pbcopy: no clipboard here");
    });
  });

  describe("copyResponse", () => {
    it("copies a string response and replaces it with a confirmation message", async () => {
      const { sut, calls } = service("darwin", {});

      const result = await sut.copyResponse(
        Response.success(new StringResponse(secret)),
        "password",
      );

      expect(calls[0].child.input.toString("utf8")).toBe(secret);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(MessageResponse);
      expect((result.data as MessageResponse).title).toBe("Copied password to clipboard.");
      expect(JSON.stringify(result)).not.toContain(secret);
    });

    it("passes failed responses through without touching the clipboard", async () => {
      const { sut, spawnFn } = service("darwin", {});
      const notFound = Response.notFound();

      const result = await sut.copyResponse(notFound, "password");

      expect(result).toBe(notFound);
      expect(spawnFn).not.toHaveBeenCalled();
    });

    it("returns an error when there is no text value to copy", async () => {
      const { sut, spawnFn } = service("darwin", {});

      const result = await sut.copyResponse(Response.success(new StringResponse("")), "notes");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Nothing was copied because the notes value is empty.");
      expect(spawnFn).not.toHaveBeenCalled();
    });

    it("returns the clipboard error instead of printing the value when copying fails", async () => {
      const { sut } = service("darwin", {}, { pbcopy: { kind: "missing" } });

      const result = await sut.copyResponse(
        Response.success(new StringResponse(secret)),
        "password",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Install one of: pbcopy");
      expect(JSON.stringify(result)).not.toContain(secret);
    });
  });
});
