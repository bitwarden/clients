import { existsSync, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { isDev } from "../../utils";
import { AgentAccessActivityEntry } from "../models/agent-access-activity";
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
import { OpenShellManagementResult } from "../models/openshell-management";
import { buildOpenShellSnippet } from "../utils/openshell-config-snippet.util";

import { AgentAccessRegistrationStatusService } from "./agent-access-registration-status.service";
import { AgentAccessRegistrationService } from "./agent-access-registration.service";
import { AgentDetectionService } from "./agent-detection.service";
import { OpenShellActivityService } from "./openshell-activity.service";
import { OpenShellCredentialRegistryService } from "./openshell-credential-registry.service";
import { OpenShellDetectionService } from "./openshell-detection.service";
import { OpenShellEnabledState } from "./openshell-enabled-state";
import { OpenShellEnvironmentsStore } from "./openshell-environments-store";
import { OpenShellEnvironmentsService } from "./openshell-environments.service";
import { OpenShellManagementService } from "./openshell-management.service";
import { OpenShellPortsService } from "./openshell-ports.service";
import { OpenShellRequestsService } from "./openshell-requests.service";
import { OpenShellSavedPortsService } from "./openshell-saved-ports.service";
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
  private readonly openShellManagementService: OpenShellManagementService;
  private readonly openShellEnvironmentsService: OpenShellEnvironmentsService;
  private readonly openShellPortsService: OpenShellPortsService;
  private readonly openShellRequestsService: OpenShellRequestsService;
  private openShellActivitySource: () => readonly AgentAccessActivityEntry[] = () => [];
  private readonly openShellActivityService: OpenShellActivityService;

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
    openShellManagementService?: OpenShellManagementService,
    private openShellEnabledState: OpenShellEnabledState = new OpenShellEnabledState(),
  ) {
    this.agentDetectionService = agentDetectionService;
    this.agentRegistrationService = agentRegistrationService;
    this.agentRegistrationStatusService = agentRegistrationStatusService;
    this.openShellDetectionService = openShellDetectionService;
    this.openShellActivityService = new OpenShellActivityService(
      logService,
      () => this.isOpenShellManagementAvailable(),
      () => this.openShellActivitySource(),
    );
    this.openShellSetupService =
      openShellSetupService ??
      new OpenShellSetupService(
        logService,
        () => this.openShellDetectionService.detect(),
        () => this.getBundledCliPath(),
        homedir,
      );
    this.openShellManagementService =
      openShellManagementService ??
      new OpenShellManagementService(
        logService,
        () => this.openShellDetectionService.detect(),
        new OpenShellCredentialRegistryService(logService, userDataPath),
        () => this.isOpenShellManagementAvailable(),
        undefined,
        undefined,
        openShellEnabledState,
      );
    // Agent permission requests (§M8.20 rule 16): same gate as management.
    this.openShellRequestsService = new OpenShellRequestsService(
      logService,
      () => this.openShellDetectionService.detect(),
      () => this.isOpenShellManagementAvailable(),
      openShellEnabledState,
    );
    this.openShellPortsService = new OpenShellPortsService(
      logService,
      () => this.openShellDetectionService.detect(),
      () => this.isOpenShellManagementAvailable(),
      new OpenShellSavedPortsService(logService, userDataPath),
      undefined,
      undefined,
      openShellEnabledState,
    );

    // Environments, secret sets and sandbox metadata (§M8.20 rule 17): app-side only, same gate.
    this.openShellEnvironmentsService = new OpenShellEnvironmentsService(
      logService,
      new OpenShellEnvironmentsStore(logService, userDataPath),
      () => this.openShellDetectionService.detect(),
      () => this.isOpenShellManagementAvailable(),
      this.openShellEnabledState,
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

    // OpenShell management page (§M8.20). Each handler takes one plain request object (or none) and
    // never a path or a command: main builds every argument list. A payload that isn't a plain
    // object is rejected before the service sees it.
    const management = this.openShellManagementService;
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_SANDBOXES, false, () =>
      management.listSandboxes(),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SANDBOX_ACTION, true, (request) =>
      management.sandboxAction(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_CREATE_SANDBOX, true, (request) =>
      management.createSandbox(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_PROFILES, false, () =>
      management.listProfiles(),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_CREDENTIALS, true, (request) =>
      management.listCredentials(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ADD_CREDENTIAL, true, (request) =>
      management.addCredential(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_REMOVE_CREDENTIAL, true, (request) =>
      management.removeCredential(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_CREATE_PROFILE, true, (request) =>
      management.createProfile(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_UPDATE_PROFILE, true, (request) =>
      management.updateProfile(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_DELETE_PROFILE, true, (request) =>
      management.deleteProfile(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_GET_APPLY_STATUS, true, (request) =>
      management.getApplyStatus(request),
    );

    const environments = this.openShellEnvironmentsService;
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ENV_LIST, false, () =>
      environments.listEnvironments(),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ENV_SAVE, true, (request) =>
      environments.saveEnvironment(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ENV_DELETE, true, (request) =>
      environments.deleteEnvironment(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SET_LIST, false, () =>
      environments.listSecretSets(),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SET_SAVE, true, (request) =>
      environments.saveSecretSet(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SET_DELETE, true, (request) =>
      environments.deleteSecretSet(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_META_GET, false, () =>
      environments.getSandboxMeta(),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_META_SET, true, (request) =>
      environments.setSandboxMeta(request),
    );
    // Open a shell and port forwards (§M8.20 rule 15).
    const ports = this.openShellPortsService;
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_FORWARDS, true, (request) =>
      ports.listForwards(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_START_FORWARD, true, (request) =>
      ports.startForward(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_STOP_FORWARD, true, (request) =>
      ports.stopForward(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_OPEN_SHELL, true, (request) =>
      ports.openShell(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SAVED_PORTS_GET, true, (request) =>
      ports.getSavedPorts(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SAVED_PORTS_SET, true, (request) =>
      ports.setSavedPorts(request),
    );
    const requests = this.openShellRequestsService;
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_REQUESTS, true, (request) =>
      requests.listRequests(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_APPROVE_REQUEST, true, (request) =>
      requests.approveRequest(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_REJECT_REQUEST, true, (request) =>
      requests.rejectRequest(request),
    );
    this.handleManagement(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_ACTIVITY, true, (request) =>
      this.openShellActivityService.listActivity(request),
    );
  }

  /** Where the Activity tab reads credential-resolve rows from (§M8.20 rule 18). Wired in main.ts to
   *  the Agent Access activity buffer; empty until then. */
  setOpenShellActivitySource(source: () => readonly AgentAccessActivityEntry[]): void {
    this.openShellActivitySource = source;
  }

  private handleManagement(
    channel: string,
    requiresRequest: boolean,
    run: (request: unknown) => Promise<OpenShellManagementResult<unknown>>,
  ): void {
    ipcMain.handle(
      channel,
      async (_event, request?: unknown): Promise<OpenShellManagementResult<unknown>> => {
        const present = request != null;
        const plain =
          present &&
          typeof request === "object" &&
          !Array.isArray(request) &&
          [Object.prototype, null].includes(Object.getPrototypeOf(request));
        if ((requiresRequest && !plain) || (present && !plain)) {
          return { ok: false, error: "invalidInput" };
        }
        try {
          return await run(request);
        } catch (e) {
          this.logService.warning(`[Agent Access] OpenShell management IPC failed: ${e}`);
          return { ok: false, error: "failed" };
        }
      },
    );
  }

  /** Management is offered only where OpenShell is present on a supported platform and the
   *  Bitwarden driver is set up and the Agent Access OpenShell toggle is on (§M8.20 rule 6). */
  private async isOpenShellManagementAvailable(): Promise<boolean> {
    if (!this.openShellEnabledState.isEnabled()) {
      return false;
    }
    const detection = await this.openShellDetectionService.detect();
    if (!detection.present || !detection.platformSupported) {
      return false;
    }
    return (await this.openShellSetupService.getStatus()).configured;
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
