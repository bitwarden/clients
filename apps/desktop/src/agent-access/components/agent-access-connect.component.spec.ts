import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AgentDetectionResult } from "../models/agent-detection";
import { AgentId } from "../models/agent-id";
import {
  buildInstallDeeplink,
  buildManualSetupCommand,
  McpRegistrationStrategyKind,
  RegisterWithAgentResult,
} from "../models/agent-registration";
import {
  AgentRegistrationStatus,
  AgentRegistrationStatusResult,
} from "../models/agent-registration-status";
import { AGENT_DEFINITIONS } from "../models/agent-registry";
import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";

import { AgentAccessConnectComponent } from "./agent-access-connect.component";

describe("AgentAccessConnectComponent", () => {
  const platformUtilsService = mock<PlatformUtilsService>();

  let originalIpc: any;
  let mockGetBundledCliPath: jest.Mock;
  let mockDetectAgents: jest.Mock;
  let mockGetAgentRegistrationStatuses: jest.Mock;
  let mockRegisterWithAgent: jest.Mock;
  let pageState: AgentAccessPageStateService;

  const AAC_PATH = "/Applications/Bitwarden.app/aac";

  function createComponent(): AgentAccessConnectComponent {
    // `AgentAccessPageStateService` is a real instance (not a mock) rather than
    // `jest-mock-extended`'s `mock<T>()`: it now owns `registrationStatuses` — the same signal the
    // Agents tab's setup checklist reads — so exercising it for real here is what actually proves
    // this component reads from and refreshes the *shared* state rather than a private copy.
    pageState = new AgentAccessPageStateService();
    TestBed.configureTestingModule({
      providers: [
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: AgentAccessPageStateService, useValue: pageState },
      ],
    });
    return TestBed.runInInjectionContext(() => new AgentAccessConnectComponent());
  }

  function detectionResult(agentId: AgentId, detected: boolean): AgentDetectionResult {
    return { agentId, detected, probeResults: [] };
  }

  function registrationStatusResult(
    agentId: AgentId,
    status: AgentRegistrationStatus,
  ): AgentRegistrationStatusResult {
    return { agentId, status };
  }

  const allNotRegistered = () =>
    Object.values(AgentId).map((agentId) =>
      registrationStatusResult(agentId, AgentRegistrationStatus.NotRegistered),
    );

  function findAgent(component: AgentAccessConnectComponent, agentId: AgentId): any {
    return (component as any).selectableAgents().find((a: any) => a.definition.id === agentId);
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetBundledCliPath = jest.fn().mockResolvedValue(AAC_PATH);
    mockDetectAgents = jest
      .fn()
      .mockResolvedValue([
        detectionResult(AgentId.Claude, false),
        detectionResult(AgentId.Codex, false),
        detectionResult(AgentId.Cursor, true),
        detectionResult(AgentId.Gemini, false),
        detectionResult(AgentId.Copilot, false),
      ]);
    mockGetAgentRegistrationStatuses = jest.fn().mockResolvedValue(allNotRegistered());
    mockRegisterWithAgent = jest.fn().mockResolvedValue({ status: "added" });

    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      agentAccess: {
        getBundledCliPath: mockGetBundledCliPath,
        detectAgents: mockDetectAgents,
        getAgentRegistrationStatuses: mockGetAgentRegistrationStatuses,
        registerWithAgent: mockRegisterWithAgent,
      },
    };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  describe("ngOnInit", () => {
    it("loads the bundled CLI path, detection results, and registration statuses in parallel", async () => {
      const component = createComponent();
      await component.ngOnInit();

      expect((component as any).loading()).toBe(false);
      expect((component as any).aacPath()).toBe(AAC_PATH);
      expect(mockDetectAgents).toHaveBeenCalled();
      expect(mockGetAgentRegistrationStatuses).toHaveBeenCalled();
    });
  });

  describe("selectableAgents — sorting and badges", () => {
    it("sorts detected agents first, keeping registry order within each group", async () => {
      const component = createComponent();
      await component.ngOnInit();

      const ids = (component as any).selectableAgents().map((a: any) => a.definition.id);
      expect(ids[0]).toBe(AgentId.Cursor);
      expect(ids.slice(1)).toEqual([
        AgentId.Claude,
        AgentId.Codex,
        AgentId.Gemini,
        AgentId.Copilot,
      ]);
    });

    it("marks a registered agent as connected", async () => {
      mockGetAgentRegistrationStatuses.mockResolvedValue([
        registrationStatusResult(AgentId.Claude, AgentRegistrationStatus.Registered),
        ...allNotRegistered().filter((r) => r.agentId !== AgentId.Claude),
      ]);
      const component = createComponent();
      await component.ngOnInit();

      expect(findAgent(component, AgentId.Claude).connected).toBe(true);
    });

    it("does not render an 'unknown' status as connected — nor as a false-negative 'not registered'", async () => {
      mockGetAgentRegistrationStatuses.mockResolvedValue([
        registrationStatusResult(AgentId.Claude, AgentRegistrationStatus.Unknown),
        registrationStatusResult(AgentId.Codex, AgentRegistrationStatus.NotRegistered),
        ...allNotRegistered().filter(
          (r) => r.agentId !== AgentId.Claude && r.agentId !== AgentId.Codex,
        ),
      ]);
      const component = createComponent();
      await component.ngOnInit();

      const claude = findAgent(component, AgentId.Claude);
      const codex = findAgent(component, AgentId.Codex);

      // Neither an unresolved ("unknown") nor a confirmed-absent ("notRegistered") status ever
      // renders as connected — but critically, "unknown" must not collapse into a *different*,
      // more negative presentation than "notRegistered" either: both simply omit the badge, so an
      // inconclusive read never asserts a fact ("not connected") the app can't back up.
      expect(claude.connected).toBe(false);
      expect(claude.badge).toBeNull();
      expect(codex.connected).toBe(false);
      expect(codex.badge).toBeNull();
    });

    it("does not mark any agent connected before a registration status is known for it", async () => {
      mockGetAgentRegistrationStatuses.mockResolvedValue([]);
      const component = createComponent();
      await component.ngOnInit();

      expect((component as any).selectableAgents().every((a: any) => !a.connected)).toBe(true);
    });

    it("shows only the 'Connected' badge — not both — when an agent is detected AND connected", async () => {
      // Cursor is detected by the default mock; mark it connected too.
      mockGetAgentRegistrationStatuses.mockResolvedValue([
        registrationStatusResult(AgentId.Cursor, AgentRegistrationStatus.Registered),
        ...allNotRegistered().filter((r) => r.agentId !== AgentId.Cursor),
      ]);
      const component = createComponent();
      await component.ngOnInit();

      const cursor = findAgent(component, AgentId.Cursor);

      expect(cursor.detected).toBe(true);
      expect(cursor.connected).toBe(true);
      // A single badge object — "Connected" implies "Detected", so only one is ever shown.
      expect(cursor.badge).toEqual({
        messageKey: "agentAccessConnectConnectedBadge",
        variant: "primary",
      });
    });

    it("shows the 'Detected' badge when an agent is detected but not yet connected", async () => {
      const component = createComponent();
      await component.ngOnInit();

      const cursor = findAgent(component, AgentId.Cursor);

      expect(cursor.detected).toBe(true);
      expect(cursor.connected).toBe(false);
      expect(cursor.badge).toEqual({
        messageKey: "agentAccessConnectDetected",
        variant: "success",
      });
    });

    it("shows no badge when an agent is neither detected nor connected", async () => {
      const component = createComponent();
      await component.ngOnInit();

      const claude = findAgent(component, AgentId.Claude);

      expect(claude.detected).toBe(false);
      expect(claude.connected).toBe(false);
      expect(claude.badge).toBeNull();
    });
  });

  describe("selectableAgents — per-strategy card action", () => {
    it("renders a ManualCommand action with the exact copy-paste command for Claude Code", async () => {
      const component = createComponent();
      await component.ngOnInit();

      const claudeStrategy = AGENT_DEFINITIONS[AgentId.Claude].registrationStrategy;
      if (claudeStrategy.kind !== McpRegistrationStrategyKind.ManualCommand) {
        throw new Error("expected Claude Code to use the ManualCommand strategy");
      }
      const expectedCommand = buildManualSetupCommand(claudeStrategy, AAC_PATH);

      const claude = findAgent(component, AgentId.Claude);
      expect(claude.action).toEqual({
        kind: McpRegistrationStrategyKind.ManualCommand,
        command: expectedCommand,
      });
      // Sanity: this is a real, agent-specific shell command, not a placeholder.
      expect(expectedCommand).toContain("claude mcp add");
      expect(expectedCommand).toContain(AAC_PATH);
    });

    it("renders a Deeplink action with the exact install URI for Cursor, and no fallback", async () => {
      const component = createComponent();
      await component.ngOnInit();

      const cursorStrategy = AGENT_DEFINITIONS[AgentId.Cursor].registrationStrategy;
      if (cursorStrategy.kind !== McpRegistrationStrategyKind.Deeplink) {
        throw new Error("expected Cursor to use the Deeplink strategy");
      }
      const expectedUri = buildInstallDeeplink(cursorStrategy, AAC_PATH);

      const cursor = findAgent(component, AgentId.Cursor);
      expect(cursor.action).toEqual({
        kind: McpRegistrationStrategyKind.Deeplink,
        deeplinkUri: expectedUri,
        hasFallback: false,
      });
      expect(expectedUri.startsWith("cursor://anysphere.cursor-deeplink/mcp/install?")).toBe(true);
    });

    it("renders a Deeplink action with hasFallback for GitHub Copilot", async () => {
      const component = createComponent();
      await component.ngOnInit();

      const copilotStrategy = AGENT_DEFINITIONS[AgentId.Copilot].registrationStrategy;
      if (copilotStrategy.kind !== McpRegistrationStrategyKind.Deeplink) {
        throw new Error("expected Copilot to use the Deeplink strategy");
      }
      const expectedUri = buildInstallDeeplink(copilotStrategy, AAC_PATH);

      const copilot = findAgent(component, AgentId.Copilot);
      expect(copilot.action).toEqual({
        kind: McpRegistrationStrategyKind.Deeplink,
        deeplinkUri: expectedUri,
        hasFallback: true,
      });
    });

    it("nulls out command/deeplinkUri (without erroring) when the bundled CLI path is unavailable", async () => {
      mockGetBundledCliPath.mockResolvedValue(null);
      const component = createComponent();
      await component.ngOnInit();

      const claude = findAgent(component, AgentId.Claude);
      expect(claude.action).toEqual({
        kind: McpRegistrationStrategyKind.ManualCommand,
        command: null,
      });

      const cursor = findAgent(component, AgentId.Cursor);
      expect(cursor.action).toEqual({
        kind: McpRegistrationStrategyKind.Deeplink,
        deeplinkUri: null,
        hasFallback: false,
      });
    });
  });

  describe("launchDeeplink", () => {
    it("hands the deeplink URI to PlatformUtilsService.launchUri", async () => {
      const component = createComponent();
      await component.ngOnInit();

      (component as any).launchDeeplink("cursor://anysphere.cursor-deeplink/mcp/install?x=1");

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "cursor://anysphere.cursor-deeplink/mcp/install?x=1",
      );
    });

    it("does nothing when the URI is null (CLI path not yet resolved)", async () => {
      const component = createComponent();
      await component.ngOnInit();

      (component as any).launchDeeplink(null);

      expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
    });
  });

  describe("registerWithAgentAction — the FileMerge write path (also used by Copilot's fallback)", () => {
    // No agent in the registry is FileMerge-primary today (agent-registry.ts), but
    // `registerWithAgentAction` is the same generic call regardless of *which* agent it's bound
    // to — the main process (`AgentAccessRegistrationService`) is what decides whether that
    // resolves to a FileMerge-primary write or a Deeplink's declared fallback. Exercising it here
    // against an arbitrary agent id covers that shared mechanics; the Copilot-specific test below
    // covers the fallback wiring itself.

    it("calls ipc.agentAccess.registerWithAgent with the given agent id", async () => {
      const component = createComponent();
      await component.ngOnInit();

      await (component as any).registerWithAgentAction(AgentId.Claude)();

      expect(mockRegisterWithAgent).toHaveBeenCalledWith(AgentId.Claude);
    });

    it("reports the outcome on that agent's own card", async () => {
      mockRegisterWithAgent.mockResolvedValue({
        status: "added",
      } satisfies RegisterWithAgentResult);
      const component = createComponent();
      await component.ngOnInit();

      await (component as any).registerWithAgentAction(AgentId.Claude)();

      const claude = findAgent(component, AgentId.Claude);
      expect(claude.connectResultMessageKey).toBe("agentAccessRegisterAgentAdded");
      expect(claude.connectResultIsError).toBe(false);
    });

    it("reports an error outcome on that agent's own card without affecting other cards", async () => {
      mockRegisterWithAgent.mockImplementation((agentId: AgentId) =>
        agentId === AgentId.Claude
          ? Promise.resolve({ status: "error" } satisfies RegisterWithAgentResult)
          : Promise.resolve({ status: "added" } satisfies RegisterWithAgentResult),
      );
      const component = createComponent();
      await component.ngOnInit();

      await (component as any).registerWithAgentAction(AgentId.Claude)();
      await (component as any).registerWithAgentAction(AgentId.Codex)();

      const claude = findAgent(component, AgentId.Claude);
      const codex = findAgent(component, AgentId.Codex);
      expect(claude.connectResultMessageKey).toBe("agentAccessRegisterAgentError");
      expect(claude.connectResultIsError).toBe(true);
      expect(codex.connectResultMessageKey).toBe("agentAccessRegisterAgentAdded");
      expect(codex.connectResultIsError).toBe(false);
    });

    it("survives the IPC call rejecting outright by reporting an error result", async () => {
      mockRegisterWithAgent.mockRejectedValue(new Error("boom"));
      const component = createComponent();
      await component.ngOnInit();

      await (component as any).registerWithAgentAction(AgentId.Claude)();

      expect(findAgent(component, AgentId.Claude).connectResultIsError).toBe(true);
    });

    it("refreshes registration statuses after the call completes", async () => {
      const component = createComponent();
      await component.ngOnInit();
      mockGetAgentRegistrationStatuses.mockClear();
      mockGetAgentRegistrationStatuses.mockResolvedValue([
        registrationStatusResult(AgentId.Claude, AgentRegistrationStatus.Registered),
        ...allNotRegistered().filter((r) => r.agentId !== AgentId.Claude),
      ]);

      await (component as any).registerWithAgentAction(AgentId.Claude)();

      expect(mockGetAgentRegistrationStatuses).toHaveBeenCalledTimes(1);
      expect(findAgent(component, AgentId.Claude).connected).toBe(true);
    });

    it("is the same action Copilot's declared-fallback button uses", async () => {
      const component = createComponent();
      await component.ngOnInit();

      await (component as any).registerWithAgentAction(AgentId.Copilot)();

      expect(mockRegisterWithAgent).toHaveBeenCalledWith(AgentId.Copilot);
      expect(findAgent(component, AgentId.Copilot).connectResultMessageKey).toBe(
        "agentAccessRegisterAgentAdded",
      );
    });
  });

  describe("refreshRegistrationStatuses", () => {
    it("re-fetches and applies the latest registration statuses", async () => {
      const component = createComponent();
      await component.ngOnInit();
      mockGetAgentRegistrationStatuses.mockResolvedValue([
        registrationStatusResult(AgentId.Claude, AgentRegistrationStatus.Registered),
        ...allNotRegistered().filter((r) => r.agentId !== AgentId.Claude),
      ]);

      await (component as any).refreshRegistrationStatuses();

      expect(findAgent(component, AgentId.Claude).connected).toBe(true);
    });

    it("writes into the shared AgentAccessPageStateService rather than a private copy", async () => {
      const component = createComponent();
      await component.ngOnInit();
      mockGetAgentRegistrationStatuses.mockResolvedValue([
        registrationStatusResult(AgentId.Claude, AgentRegistrationStatus.Registered),
        ...allNotRegistered().filter((r) => r.agentId !== AgentId.Claude),
      ]);

      await (component as any).refreshRegistrationStatuses();

      // The Agents tab's setup checklist reads this same signal off this same service instance to
      // decide whether its "Connect an AI assistant" task is complete — this is the other half of
      // that contract: this component's own refresh is what populates it.
      expect(
        pageState
          .registrationStatuses()
          .some(
            (r) => r.agentId === AgentId.Claude && r.status === AgentRegistrationStatus.Registered,
          ),
      ).toBe(true);
    });

    it("reflects a registration status set elsewhere on the shared service, proving it reads the shared signal rather than a private copy", async () => {
      const component = createComponent();
      await component.ngOnInit();

      // Simulate some other consumer of the same per-route service instance (in practice nothing
      // else writes to this signal today, but the point is this component must not be caching its
      // own copy) updating the shared signal directly.
      pageState.registrationStatuses.set([
        registrationStatusResult(AgentId.Claude, AgentRegistrationStatus.Registered),
        ...allNotRegistered().filter((r) => r.agentId !== AgentId.Claude),
      ]);

      expect(findAgent(component, AgentId.Claude).connected).toBe(true);
    });

    it("re-runs on window focus, so ManualCommand/Deeplink outcomes (invisible to this app any other way) get picked up when the user tabs back in", async () => {
      const component = createComponent();
      await component.ngOnInit();
      mockGetAgentRegistrationStatuses.mockClear();
      mockGetAgentRegistrationStatuses.mockResolvedValue([
        registrationStatusResult(AgentId.Claude, AgentRegistrationStatus.Registered),
        ...allNotRegistered().filter((r) => r.agentId !== AgentId.Claude),
      ]);

      (component as any).onWindowFocus();
      // `onWindowFocus` fires the refresh without awaiting it (a floating promise would be an
      // eslint violation), so let the microtask queue drain before asserting.
      await Promise.resolve();
      await Promise.resolve();

      expect(mockGetAgentRegistrationStatuses).toHaveBeenCalled();
    });
  });

  describe("mcpConfigJson", () => {
    it("builds the mcpServers config from the bundled CLI path", async () => {
      const component = createComponent();
      await component.ngOnInit();

      const json = (component as any).mcpConfigJson();

      expect(JSON.parse(json)).toEqual({
        mcpServers: { bitwarden: { command: AAC_PATH, args: ["mcp"] } },
      });
    });

    it("is null when the bundled CLI path is unavailable", async () => {
      mockGetBundledCliPath.mockResolvedValue(null);
      const component = createComponent();
      await component.ngOnInit();

      expect((component as any).aacPath()).toBeNull();
      expect((component as any).mcpConfigJson()).toBeNull();
    });
  });

  describe("disclosure escape hatch", () => {
    it("collapses by default and exposes the raw MCP config for copying", async () => {
      const component = createComponent();
      await component.ngOnInit();

      expect((component as any).mcpConfigOpen()).toBe(false);
      expect((component as any).mcpConfigJson()).toContain("mcpServers");

      (component as any).mcpConfigOpen.set(true);
      expect((component as any).mcpConfigOpen()).toBe(true);
    });
  });
});
