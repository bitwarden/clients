import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AgentAccessPairAgentDialogComponent } from "./agent-access-pair-agent-dialog.component";

describe("AgentAccessPairAgentDialogComponent", () => {
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();

  let originalIpc: any;
  let mockIsLoaded: jest.Mock;
  let mockGeneratePskToken: jest.Mock;

  /** Builds the component outside a full render — this dialog only injects these two services. */
  function createComponent(): AgentAccessPairAgentDialogComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
      ],
    });
    return TestBed.runInInjectionContext(() => new AgentAccessPairAgentDialogComponent());
  }

  async function pair(component: AgentAccessPairAgentDialogComponent): Promise<void> {
    await (component as any).generatePairingCredential();
  }

  beforeEach(() => {
    jest.clearAllMocks();

    i18nService.t.mockImplementation((key: string, p1?: string | number, p2?: string | number) =>
      [key, p1, p2].filter((v) => v !== undefined).join("|"),
    );

    mockIsLoaded = jest.fn().mockResolvedValue(true);
    mockGeneratePskToken = jest.fn().mockResolvedValue("psk-token-123");

    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      agentAccess: {
        isLoaded: mockIsLoaded,
        generatePskToken: mockGeneratePskToken,
      },
    };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  describe("pairCommand", () => {
    it("uses the bare `aac` CLI, since the remote agent installs its own", async () => {
      const component = createComponent();
      await component.ngOnInit();

      await pair(component);

      expect((component as any).pairCommand()).toBe("aac connect --token psk-token-123");
    });

    it("is null before a token has been generated", async () => {
      const component = createComponent();
      await component.ngOnInit();

      expect((component as any).pairCommand()).toBeNull();
      expect((component as any).agentPrompt()).toBeNull();
    });
  });

  describe("agentPrompt", () => {
    it("uses the remote prompt with the bare `aac` CLI name, never the live PSK token", async () => {
      const component = createComponent();
      await component.ngOnInit();

      await pair(component);

      expect((component as any).agentPrompt()).not.toBeNull();
      expect(i18nService.t).toHaveBeenCalledWith("agentAccessAgentPromptRemote", "aac");

      // Regression test for the PSK-leak finding: none of the arguments passed while building
      // the agent-pasteable instructions may contain the live pairing token, even though the
      // human-facing `pairCommand()` does.
      const agentPromptCall = i18nService.t.mock.calls.find(
        ([key]) => key === "agentAccessAgentPromptRemote",
      );
      const leaksToken = agentPromptCall?.some(
        (arg) => typeof arg === "string" && arg.includes("psk-token-123"),
      );
      expect(leaksToken).toBe(false);
    });
  });

  describe("token generation", () => {
    it("requests a reusable token so an ephemeral agent can re-pair unattended", async () => {
      const component = createComponent();
      await component.ngOnInit();
      (component as any).pairForm.patchValue({ agentName: "  claude  " });

      await pair(component);

      expect(mockGeneratePskToken).toHaveBeenCalledWith("claude", true);
    });

    it("sends a null name when the field is left blank", async () => {
      const component = createComponent();
      await component.ngOnInit();

      await pair(component);

      expect(mockGeneratePskToken).toHaveBeenCalledWith(null, true);
    });
  });

  describe("agentRunning", () => {
    it("reflects whether the local Agent Access listener is loaded", async () => {
      mockIsLoaded.mockResolvedValue(false);
      const component = createComponent();

      await component.ngOnInit();

      expect((component as any).agentRunning()).toBe(false);
    });
  });
});
