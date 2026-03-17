import { ChildProcess, spawn } from "child_process";
import * as path from "path";

/**
 * Spawns and manages a local ap-proxy server for E2E testing.
 *
 * Parses the bound port from the server's tracing output.
 * Requires the remote-access repo to be built (`cargo build -p ap-proxy`).
 */
export class ProxyServerHarness {
  private process: ChildProcess | null = null;
  private _port: number | null = null;

  constructor(private remoteAccessRepoPath?: string) {}

  get port(): number {
    if (this._port == null) {
      throw new Error("ProxyServerHarness: server not started");
    }
    return this._port;
  }

  get url(): string {
    return `ws://127.0.0.1:${this.port}`;
  }

  /**
   * Start the proxy server. Resolves with the port once the server
   * prints its bind address.
   */
  async start(): Promise<number> {
    const repoPath =
      this.remoteAccessRepoPath || process.env.REMOTE_ACCESS_REPO_PATH || "../remote-access";

    return new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        void this.stop();
        reject(new Error("ProxyServerHarness: timed out waiting for server to start"));
      }, 15000);

      this.process = spawn("cargo", ["run", "-p", "ap-proxy"], {
        cwd: path.resolve(repoPath),
        env: {
          ...process.env,
          BIND_ADDR: "127.0.0.1:0",
          RUST_LOG: "info",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      const handleOutput = (data: Buffer) => {
        const line = data.toString();

        // Look for the bind address in tracing output
        // Expected format: "Starting proxy server on 127.0.0.1:XXXX"
        // or "listening on 127.0.0.1:XXXX"
        const portMatch = line.match(/(?:on|listening on)\s+127\.0\.0\.1:(\d+)/i);
        if (portMatch) {
          clearTimeout(timeout);
          this._port = parseInt(portMatch[1], 10);
          resolve(this._port);
        }
      };

      this.process.stdout?.on("data", handleOutput);
      this.process.stderr?.on("data", handleOutput);

      this.process.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`ProxyServerHarness: failed to spawn: ${err.message}`));
      });

      this.process.on("exit", (code) => {
        if (this._port == null) {
          clearTimeout(timeout);
          reject(new Error(`ProxyServerHarness: process exited with code ${code} before binding`));
        }
      });
    });
  }

  /** Stop the proxy server gracefully. */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill("SIGKILL");
        resolve();
      }, 5000);

      this.process!.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.process!.kill("SIGTERM");
      this.process = null;
      this._port = null;
    });
  }
}
