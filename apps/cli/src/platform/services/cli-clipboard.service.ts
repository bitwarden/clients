import { spawn } from "child_process";

import { Response } from "../../models/response";
import { MessageResponse } from "../../models/response/message.response";
import { StringResponse } from "../../models/response/string.response";

/** A command line tool that reads text on stdin and puts it on the system clipboard. */
export interface ClipboardTool {
  command: string;
  args: string[];
  encoding: "utf8" | "utf16le";
}

type SpawnFn = typeof spawn;

class ToolNotInstalledError extends Error {
  constructor() {
    super("not installed");
  }
}

const DEFAULT_TIMEOUT_MS = 5000;

const PBCOPY: ClipboardTool = { command: "pbcopy", args: [], encoding: "utf8" };
const CLIP_EXE: ClipboardTool = { command: "clip.exe", args: [], encoding: "utf16le" };
const WL_COPY: ClipboardTool = { command: "wl-copy", args: [], encoding: "utf8" };
const XCLIP: ClipboardTool = {
  command: "xclip",
  args: ["-selection", "clipboard"],
  encoding: "utf8",
};
const XSEL: ClipboardTool = { command: "xsel", args: ["--clipboard", "--input"], encoding: "utf8" };

/**
 * Copies text to the system clipboard by piping it to the platform's clipboard tool.
 *
 * The value is always written to the tool's stdin, never passed as an argument, so it
 * does not show up in the process list or in shell history.
 */
export class CliClipboardService {
  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly spawnFn: SpawnFn = spawn,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  /** The clipboard tools to try on this platform, in order of preference. */
  getTools(): ClipboardTool[] {
    switch (this.platform) {
      case "darwin":
        return [PBCOPY];
      case "win32":
        return [CLIP_EXE];
      default: {
        const tools: ClipboardTool[] = [];
        if (this.env.WAYLAND_DISPLAY) {
          tools.push(WL_COPY);
        }
        if (this.env.DISPLAY) {
          tools.push(XCLIP, XSEL);
        }
        if (this.env.WSL_DISTRO_NAME || this.env.WSL_INTEROP) {
          tools.push(CLIP_EXE);
        }
        return tools;
      }
    }
  }

  /**
   * Copies `text` to the clipboard using the first tool that works.
   * @throws if no clipboard tool is available or every tool failed.
   */
  async copy(text: string): Promise<void> {
    const tools = this.getTools();
    if (tools.length === 0) {
      throw new Error(
        "No clipboard is available. Copying requires a graphical session " +
          "(WAYLAND_DISPLAY or DISPLAY must be set).",
      );
    }

    const failures: string[] = [];
    let anyToolInstalled = false;
    for (const tool of tools) {
      try {
        await this.runTool(tool, text);
        return;
      } catch (e) {
        if (!(e instanceof ToolNotInstalledError)) {
          anyToolInstalled = true;
        }
        failures.push(`${tool.command}: ${(e as Error).message}`);
      }
    }

    if (!anyToolInstalled) {
      throw new Error(
        `Could not copy to the clipboard. Install one of: ${tools
          .map((t) => t.command)
          .join(", ")}.`,
      );
    }
    throw new Error(`Could not copy to the clipboard. (${failures.join("; ")})`);
  }

  /**
   * Copies the string value of a successful command response to the clipboard and replaces
   * it with a confirmation message, so the secret is never written to stdout.
   */
  async copyResponse(response: Response, description: string): Promise<Response> {
    if (!response.success) {
      return response;
    }

    const value =
      response.data?.object === "string" ? (response.data as StringResponse).data : null;
    if (value == null || value === "") {
      return Response.error(`Nothing was copied because the ${description} value is empty.`);
    }

    try {
      await this.copy(value);
    } catch (e) {
      return Response.error((e as Error).message);
    }

    return Response.success(new MessageResponse(`Copied ${description} to clipboard.`, null));
  }

  private runTool(tool: ClipboardTool, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let stderr = "";

      const child = this.spawnFn(tool.command, tool.args, {
        // stdout is ignored because tools like xclip and wl-copy fork a background process
        // that keeps serving the selection and would otherwise hold the pipe open.
        stdio: ["pipe", "ignore", "pipe"],
        windowsHide: true,
      });

      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        // Release our end of stderr so a forked clipboard daemon can't keep the CLI alive.
        child.stderr?.destroy();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      const timer = setTimeout(() => {
        child.kill();
        finish(new Error(`timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.on("error", (e: NodeJS.ErrnoException) => {
        finish(e.code === "ENOENT" ? new ToolNotInstalledError() : new Error(e.message));
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      // Listen for "exit" rather than "close": a forked clipboard daemon may keep stderr open.
      child.on("exit", (code, signal) => {
        if (code === 0) {
          finish();
        } else {
          const reason = stderr.trim() || (signal ? `killed by ${signal}` : `exit code ${code}`);
          finish(new Error(reason));
        }
      });

      child.stdin?.on("error", () => {
        // The tool exited before reading its input; the exit handler reports the failure.
      });
      child.stdin?.end(this.encode(tool, text));
    });
  }

  private encode(tool: ClipboardTool, text: string): Buffer {
    if (tool.encoding === "utf16le") {
      // clip.exe reads its input in the console code page unless it starts with a UTF-16LE
      // byte order mark, which would mangle non-ASCII passwords.
      return Buffer.from("\ufeff" + text, "utf16le");
    }
    return Buffer.from(text, "utf8");
  }
}
