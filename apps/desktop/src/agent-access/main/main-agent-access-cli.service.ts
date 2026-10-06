import { existsSync, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { isDev } from "../../utils";
import { AgentDetectionResult } from "../models/agent-detection";
import { AgentId } from "../models/agent-id";
import { RegisterWithAgentResult } from "../models/agent-registration";
import { AgentRegistrationStatusResult } from "../models/agent-registration-status";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import {
  OPENSHELL_DEFAULT_GATEWAY_NAME,
  OPENSHELL_DRIVER_SOCKET_FILENAME,
  OpenShellDetectionResult,
  OpenShellSetupResult,
  OpenShellSetupStatus,
  OpenShellSnippet,
} from "../models/openshell";
import { buildOpenShellSnippet } from "../utils/openshell-config-snippet.util";

import { AgentAccessRegistrationStatusService } from "./agent-access-registration-status.service";
import { AgentAccessRegistrationService } from "./agent-access-registration.service";
import { AgentDetectionService } from "./agent-detection.service";
import { OpenShellDetectionService } from "./openshell-detection.service";
import { OpenShellSetupService } from "./openshell-setup.service";

// Name of the bundled Agent Access CLI binary. Packaging places it at:
//   macOS:   <app>/Contents/MacOS/aac
//   Windows: aac.exe next to the main exe
//   Linux:   aac next to the app binary
// macOS's "Contents/MacOS" directory *is* the directory the main executable lives in for a .app
// bundle, so all three platforms resolve the same way: next to the exe, with a
// platform-appropriate extension.
const CLI_BINARY_NAME = "aac";

export class MainAgentAccessCliService {
  private readonly agentDetectionService: AgentDetectionService;
  private readonly agentRegistrationService: AgentAccessRegistrationService;
  private readonly agentRegistrationStatusService: AgentAccessRegistrationStatusService;
  private readonly openShellDetectionService: OpenShellDetectionService;
  private readonly openShellSetupService: OpenShellSetupService;

  constructor(
    private logService: LogService,
    private userDataPath: string,
    private exePath: string,
    private appPath: string,
    agentDetectionService: AgentDetectionService = new AgentDetectionService(logService),
    agentRegistrationService: AgentAccessRegistrationService = new AgentAccessRegistrationService(
      logService,
    ),
    agentRegistrationStatusService: AgentAccessRegistrationStatusService = new AgentAccessRegistrationStatusService(
      logService,
    ),
    openShellDetectionService: OpenShellDetectionService = new OpenShellDetectionService(
      logService,
    ),
    private homedir: string = os.homedir(),
    openShellSetupService?: OpenShellSetupService,
  ) {
    this.agentDetectionService = agentDetectionService;
    this.agentRegistrationService = agentRegistrationService;
    this.agentRegistrationStatusService = agentRegistrationStatusService;
    this.openShellDetectionService = openShellDetectionService;
    this.openShellSetupService =
      openShellSetupService ??
      new OpenShellSetupService(
        logService,
        () => this.openShellDetectionService.detect(),
        () => this.getBundledCliPath(),
        homedir,
      );

    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.GET_BUNDLED_CLI_PATH, async () => {
      return this.getBundledCliPath();
    });

    // Multi-agent support (M3, agent-access-architecture.md): which supported agent clients
    // (models/agent-registry.ts) are installed on this machine.
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.DETECT_AGENTS,
      async (): Promise<AgentDetectionResult[]> => {
        return this.agentDetectionService.detectAgents();
      },
    );

    // Multi-agent support (M3): registers the bundled `aac mcp` server with a given agent. Same
    // CLI-path resolution rationale as DETECT_AGENTS above — resolved here rather than trusting a
    // renderer-supplied path.
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.REGISTER_WITH_AGENT,
      async (_event, agentId: AgentId): Promise<RegisterWithAgentResult> => {
        const bundledCliPath = await this.getBundledCliPath();
        return this.agentRegistrationService.registerWithAgent(agentId, bundledCliPath);
      },
    );

    // Read-only per-agent registration status (used for the UI's persistent "Connected" state).
    // Never writes and never shells out — see AgentAccessRegistrationStatusService.
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.GET_AGENT_REGISTRATION_STATUSES,
      async (): Promise<AgentRegistrationStatusResult[]> => {
        return this.agentRegistrationStatusService.getAgentRegistrationStatuses();
      },
    );

    // Optional OpenShell integration (agent-access-architecture.md, §M8.8). Detection is
    // read-only and never spawns or connects; the snippet is the manual fallback. The setup
    // channels (§M8.19) are the only ones that write an OpenShell file or run a process, and take
    // no arguments: main chooses every path and command.
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.DETECT_OPENSHELL,
      async (): Promise<OpenShellDetectionResult> => this.openShellDetectionService.detect(),
    );
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.GET_OPENSHELL_SNIPPET,
      async (): Promise<OpenShellSnippet | null> => this.getOpenShellSnippet(),
    );
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.GET_OPENSHELL_SETUP_STATUS,
      async (): Promise<OpenShellSetupStatus> => this.openShellSetupService.getStatus(),
    );
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.RUN_OPENSHELL_SETUP,
      async (): Promise<OpenShellSetupResult> => this.openShellSetupService.setUp(),
    );
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.REMOVE_OPENSHELL_SETUP,
      async (): Promise<OpenShellSetupResult> => this.openShellSetupService.remove(),
    );
  }

  /**
   * The copyable `gateway.toml` snippet (§M8.8). Every input is main-owned: the bundled aac path,
   * the detected gateway name, and the fixed driver socket path — nothing comes from the renderer.
   * `null` when the integration can't be offered here or there is no bundled aac to point at.
   */
  async getOpenShellSnippet(): Promise<OpenShellSnippet | null> {
    const detection = await this.openShellDetectionService.detect();
    if (!detection.present || !detection.platformSupported) {
      return null;
    }
    const aacPath = await this.getBundledCliPath();
    if (aacPath == null) {
      return null;
    }
    const gatewayName =
      detection.gateways.find((gateway) => gateway.active)?.name ??
      detection.gateways[0]?.name ??
      OPENSHELL_DEFAULT_GATEWAY_NAME;
    return buildOpenShellSnippet({
      aacPath,
      gatewayName,
      driverSocketPath: path.join(this.homedir, OPENSHELL_DRIVER_SOCKET_FILENAME),
    });
  }

  // Resolves the path to the bundled `aac` CLI binary for the renderer to hand to a user who
  // wants to install/link it manually. Never throws: a dev build (or any build where packaging
  // hasn't produced the binary) simply doesn't have one, and the renderer treats `null` as
  // "instruct the user to install it themselves" rather than an error condition.
  async getBundledCliPath(): Promise<string | null> {
    const bundledPath = this.resolveBundledBinaryPath();
    if (bundledPath == null || !existsSync(bundledPath)) {
      return null;
    }

    if (process.platform !== "linux") {
      return bundledPath;
    }

    // On Linux the app may be running inside a Snap or Flatpak sandbox, where the in-bundle
    // path (e.g. under /snap/.../current/...) is only reachable from *inside* that sandbox.
    // Anything outside it — including a terminal the user opens to run `aac` by hand, or another
    // process they want to point at it — can't see that path at all. Copying (or, preferably,
    // hard-linking) the binary out to a canonical path under the app's userData dir gives callers
    // a stable location that's reachable regardless of how the app itself was packaged. This
    // mirrors NativeMessagingMain's `linkOrCopy` for the same reason: see
    // apps/desktop/src/main/native-messaging.main.ts.
    try {
      return await this.copyOutForLinux(bundledPath);
    } catch (e) {
      this.logService.warning(
        `[Agent Access] Failed to copy out bundled CLI binary from ${bundledPath}: ${e}`,
      );
      return null;
    }
  }

  private resolveBundledBinaryPath(): string | null {
    const ext = process.platform === "win32" ? ".exe" : "";

    if (isDev()) {
      // Unpackaged runs read the build artifact straight out of `desktop_native/dist`, which is
      // where build.js deposits it (`dist/<bin>.<platform>-<arch>`) for *both* debug and release
      // profiles — unlike `target/<profile>/`, which only holds whichever profile was last built.
      // isDev() is also true for a production build launched with ELECTRON_IS_DEV=1, where this
      // path won't exist; returning null there is correct, since the packaged binary isn't
      // alongside a dev build either.
      const devPath = path.join(
        this.appPath,
        "..",
        "desktop_native",
        "dist",
        `${CLI_BINARY_NAME}.${process.platform}-${process.arch}${ext}`,
      );
      return existsSync(devPath) ? devPath : null;
    }

    return path.join(path.dirname(this.exePath), `${CLI_BINARY_NAME}${ext}`);
  }

  private async copyOutForLinux(bundledPath: string): Promise<string> {
    const canonicalPath = this.linuxCanonicalCliPath();
    await fs.mkdir(path.dirname(canonicalPath), { recursive: true });
    await this.linkOrCopy(bundledPath, canonicalPath);
    return canonicalPath;
  }

  // Canonical, user-writable location the copied-out binary is linked/copied to on Linux. Lives
  // under the app's userData dir (rather than e.g. a browser-specific directory, as
  // NativeMessagingMain uses) because this path isn't tied to any particular consumer — it just
  // needs to be stable and reachable from outside a sandbox.
  private linuxCanonicalCliPath(): string {
    return path.join(this.userDataPath, "bin", CLI_BINARY_NAME);
  }

  private async linkOrCopy(source: string, destination: string): Promise<void> {
    try {
      const [sourceStat, destStat] = await Promise.all([
        fs.stat(source),
        fs.stat(destination).catch((): null => null),
      ]);
      if (destStat != null && destStat.ino === sourceStat.ino) {
        // Already hard-linked to the current binary. Skipping avoids unnecessary filesystem
        // churn since this can be invoked every time the renderer asks for the CLI path (e.g.
        // each time a settings page mounts).
        return;
      }
    } catch (e) {
      this.logService.warning(`[Agent Access] Failed to stat CLI binary paths: ${e}`);
    }

    try {
      if (existsSync(destination)) {
        await fs.unlink(destination);
      }
      await fs.link(source, destination);
      this.logService.info(`[Agent Access] Hard-linked ${source} to ${destination}`);
    } catch (e) {
      this.logService.warning(
        `[Agent Access] Failed to hard-link ${source} to ${destination}, copying instead: ${e}`,
      );
      await fs.copyFile(source, destination);
      this.logService.info(`[Agent Access] Copied ${source} to ${destination}`);
    }
  }
}
