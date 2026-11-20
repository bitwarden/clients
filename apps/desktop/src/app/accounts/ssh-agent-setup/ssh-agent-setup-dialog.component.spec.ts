import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import {
  SshAgentSetupApplyResult,
  SshAgentSetupEnvironment,
  SshAgentSetupMode,
  SshAgentSetupPlan,
  SshAgentSetupStepKind,
  SshAgentSetupStepStatus,
  SshAgentVerifyOutcome,
  SshAgentVerifyResult,
} from "../../../autofill/models/ssh-agent-setup";

import {
  SshAgentSetupDialogComponent,
  SshAgentSetupDialogData,
  SshAgentSetupStartAt,
} from "./ssh-agent-setup-dialog.component";
import { SSH_AGENT_HELP_URL } from "./ssh-agent-setup-text";
import { SshAgentSetupClient } from "./ssh-agent-setup.client";

// bit-dialog and bit-status-lockup observe layout; JSDOM implements neither observer.
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.ResizeObserver = ObserverStub as unknown as typeof ResizeObserver;
global.IntersectionObserver = ObserverStub as unknown as typeof IntersectionObserver;

const automaticEnvironment = (
  overrides: Partial<SshAgentSetupEnvironment> = {},
): SshAgentSetupEnvironment => ({
  platform: "mac",
  packaging: "standard",
  mode: SshAgentSetupMode.Automatic,
  socketAddress: "/Users/test/.bitwarden-ssh-agent.sock",
  intendedSocketAddress: "/Users/test/.bitwarden-ssh-agent.sock",
  agentEnabled: true,
  agentRunning: true,
  otherAgents: [],
  ...overrides,
});

const plan = (overrides: Partial<SshAgentSetupPlan> = {}): SshAgentSetupPlan => ({
  planId: "plan-1",
  steps: [
    {
      id: "ssh-config",
      kind: SshAgentSetupStepKind.SshConfigInclude,
      status: SshAgentSetupStepStatus.Pending,
      displayPath: "~/.ssh/config",
      addedLines: ["Include ~/.ssh/bitwarden_agent.conf # Added by Bitwarden"],
    },
    {
      id: "zshrc",
      kind: SshAgentSetupStepKind.ShellProfile,
      status: SshAgentSetupStepStatus.Conflict,
      displayPath: "~/.zshrc",
      addedLines: ["export SSH_AUTH_SOCK=~/.bitwarden-ssh-agent.sock # Added by Bitwarden"],
      conflict: { existingLine: "export SSH_AUTH_SOCK=~/.other/agent.sock", lineNumber: 12 },
    },
    {
      id: "bashrc",
      kind: SshAgentSetupStepKind.ShellProfile,
      status: SshAgentSetupStepStatus.Blocked,
      displayPath: "~/.bashrc",
      addedLines: ["export SSH_AUTH_SOCK=~/.bitwarden-ssh-agent.sock"],
      blockedReasonKey: "sshAgentSetupBlockedSymlink",
    },
  ],
  guidedCommands: [],
  ...overrides,
});

const allOk: SshAgentVerifyResult = {
  agent: SshAgentVerifyOutcome.Ok,
  sshClient: SshAgentVerifyOutcome.Ok,
  shell: SshAgentVerifyOutcome.Ok,
};

describe("SshAgentSetupDialogComponent", () => {
  let fixture: ComponentFixture<SshAgentSetupDialogComponent>;
  let client: MockProxy<SshAgentSetupClient>;
  let dialogRef: MockProxy<DialogRef<void>>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  const query = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
    fixture.nativeElement.querySelector(selector);
  const queryAll = (selector: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));
  const text = (selector: string) => query(selector)?.textContent?.trim() ?? "";
  const view = () => query("[data-testid='ssh-agent-setup-dialog']")?.dataset.view;

  const radio = (id: "bitwarden" | "current") =>
    query<HTMLInputElement>(`#ssh-agent-setup_radio_${id}`);
  const click = async (selector: string) => {
    query<HTMLButtonElement>(selector)?.click();
    await settle();
  };
  const apply = () => click("#ssh-agent-setup_button_apply");
  const choose = async (id: "bitwarden" | "current") => {
    radio(id)?.click();
    await settle();
  };

  /** Lets pending client promises resolve and the view catch up. */
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  };

  const i18nService = mock<I18nService>();

  const create = async (data: SshAgentSetupDialogData = {}, { skipIntro = true } = {}) => {
    await TestBed.configureTestingModule({
      imports: [SshAgentSetupDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: SshAgentSetupClient, useValue: client },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: data },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          provide: ThemeStateService,
          useValue: { selectedTheme$: new BehaviorSubject(ThemeTypes.Light) },
        },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: new BehaviorSubject(ThemeTypes.Light) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SshAgentSetupDialogComponent);
    fixture.detectChanges();
    await settle();
    if (skipIntro && query("#ssh-agent-setup_button_intro-set-up") != null) {
      await click("#ssh-agent-setup_button_intro-set-up");
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key: string) => key);
    client = mock<SshAgentSetupClient>();
    dialogRef = mock<DialogRef<void>>();
    platformUtilsService = mock<PlatformUtilsService>();
    client.getEnvironment.mockResolvedValue(automaticEnvironment());
    client.getPlan.mockResolvedValue(plan());
    client.verify.mockResolvedValue(allOk);
  });

  describe("structure", () => {
    it("has one dialog with a fixed title and no stepper in every view", async () => {
      await create({}, { skipIntro: false });
      expect(queryAll("bit-dialog")).toHaveLength(1);
      expect(text("[bitDialogTitle], [data-testid='bit-dialog-title']")).toContain(
        "sshAgentSetupTitleVfo1",
      );
      expect(query("bit-stepper")).toBeNull();

      await click("#ssh-agent-setup_button_intro-set-up");

      expect(queryAll("bit-dialog")).toHaveLength(1);
      expect(text("[data-testid='bit-dialog-title']")).toContain("sshAgentSetupTitleVfo1");
      expect(query("bit-stepper")).toBeNull();
    });

    it("never offers Not now", async () => {
      await create();
      expect(query("#ssh-agent-setup_button_skip")).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain("sshAgentSetupNotNowButtonVfo2");
    });

    it("keeps one live region across progress and result", async () => {
      let finish: (value: SshAgentVerifyResult) => void = () => undefined;
      client.verify.mockReturnValue(new Promise<SshAgentVerifyResult>((r) => (finish = r)));
      client.apply.mockResolvedValue([]);
      await create();

      expect(queryAll("[aria-live]")).toHaveLength(0);
      await apply();
      expect(view()).toBe("applying");
      expect(queryAll("[aria-live]")).toHaveLength(1);

      finish(allOk);
      await settle();
      expect(view()).toBe("result");
      const regions = queryAll("[aria-live]");
      expect(regions).toHaveLength(1);
      expect(regions[0].getAttribute("aria-live")).toBe("polite");
      expect(regions[0].getAttribute("role")).toBe("status");
      expect(regions[0].closest("app-ssh-agent-setup-verify")).not.toBeNull();
    });
  });

  describe("intro", () => {
    it("shows first, with nothing applied and no choose view yet", async () => {
      await create({}, { skipIntro: false });

      expect(view()).toBe("intro");
      expect(text("[data-testid='ssh-agent-setup-intro-text']")).toBe("sshAgentSetupIntroDescVfo1");
      expect(query("#ssh-agent-setup_button_intro-set-up")).not.toBeNull();
      expect(query("#ssh-agent-setup_button_apply")).toBeNull();
      expect(query("app-ssh-agent-setup-preview")).toBeNull();
      expect(client.apply).not.toHaveBeenCalled();
    });

    it("uses copy that does not promise automatic changes on guided devices", async () => {
      client.getEnvironment.mockResolvedValue(
        automaticEnvironment({
          mode: SshAgentSetupMode.Guided,
          guidedReasonKey: "sshAgentSetupGuidedReasonWindows",
        }),
      );
      await create({}, { skipIntro: false });

      expect(text("[data-testid='ssh-agent-setup-intro-text']")).toBe(
        "sshAgentSetupIntroDescGuidedVfo1",
      );
    });

    it("moves to the choose view on Set up without applying anything", async () => {
      await create({}, { skipIntro: false });

      await click("#ssh-agent-setup_button_intro-set-up");

      expect(view()).toBe("choose");
      expect(query("[data-testid='ssh-agent-setup-intro']")).toBeNull();
      expect(query("app-ssh-agent-setup-preview")).not.toBeNull();
      expect(client.apply).not.toHaveBeenCalled();
    });

    it("opens the help article from Learn more and stays on the intro", async () => {
      await create({}, { skipIntro: false });

      await click("#ssh-agent-setup_button_intro-learn-more");

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(SSH_AGENT_HELP_URL);
      expect(view()).toBe("intro");
    });

    it("is skipped when opened on the check", async () => {
      await create({ startAt: SshAgentSetupStartAt.Verify }, { skipIntro: false });

      expect(query("#ssh-agent-setup_button_intro-set-up")).toBeNull();
      expect(view()).toBe("result");
      expect(query("#ssh-agent-setup_button_done")).not.toBeNull();
    });
  });

  describe("focus", () => {
    it("moves focus to the new view's heading on every view change", async () => {
      const focusSpy = jest.spyOn(HTMLElement.prototype, "focus");
      const focused = () =>
        focusSpy.mock.contexts.map((el) => (el as HTMLElement).id).filter(Boolean);
      await create({}, { skipIntro: false });
      expect(focused()).toContain("ssh-agent-setup_text_intro");

      focusSpy.mockClear();
      await click("#ssh-agent-setup_button_intro-set-up");
      expect(focused()).toContain("ssh-agent-setup_text_choose");

      let finish: (value: SshAgentSetupApplyResult[]) => void = () => undefined;
      client.apply.mockReturnValue(new Promise((r) => (finish = r)));
      focusSpy.mockClear();
      await apply();
      expect(focused()).toContain("ssh-agent-setup_text_progress");

      focusSpy.mockClear();
      finish([]);
      await settle();
      expect(focused()).toContain("ssh-agent-setup_text_result");
      focusSpy.mockRestore();
    });

    it("puts the initial focus attribute on the primary action of each view", async () => {
      await create({}, { skipIntro: false });
      expect(query("#ssh-agent-setup_button_intro-set-up")?.hasAttribute("cdkFocusInitial")).toBe(
        true,
      );

      await click("#ssh-agent-setup_button_intro-set-up");
      expect(query("#ssh-agent-setup_button_apply")?.hasAttribute("cdkFocusInitial")).toBe(true);
    });
  });

  describe("agent problem", () => {
    it.each([
      [
        "address-in-use",
        "sshAgentSetupAgentAddressInUseVfo7",
        "sshAgentSetupAgentAddressInUseDetailVfo7",
      ],
      [
        "permission-denied",
        "sshAgentSetupAgentPermissionDeniedVfo7",
        "sshAgentSetupAgentPermissionDeniedDetailVfo7",
      ],
      ["unknown", "sshAgentSetupAgentStartUnknownVfo7", "sshAgentSetupAgentUnknownDetailVfo7"],
    ] as const)(
      "shows a danger callout, technical details and Try again for %s",
      async (code, key, detailKey) => {
        client.getEnvironment.mockResolvedValue(
          automaticEnvironment({ agentRunning: false, startErrorCode: code }),
        );

        await create();

        expect(view()).toBe("agent-problem");
        const problem = query("[data-testid='ssh-agent-setup-agent-problem']");
        expect(problem?.dataset.severity).toBe("danger");
        expect(problem?.textContent).toContain("sshAgentSetupAgentCantStartTitleVfo7");
        expect(problem?.textContent).toContain(key);
        expect(problem?.textContent).toContain("sshAgentSetupTechnicalDetailsVfo7");
        expect(problem?.textContent).toContain(detailKey);
        expect(query("#ssh-agent-setup_button_retry-agent")).not.toBeNull();
        expect(query("#ssh-agent-setup_button_close")).not.toBeNull();
        expect(query("app-ssh-agent-setup-preview")).toBeNull();
        expect(client.apply).not.toHaveBeenCalled();
      },
    );

    it("shows an info callout with Close only when the agent is switched off", async () => {
      client.getEnvironment.mockResolvedValue(
        automaticEnvironment({ agentRunning: false, agentEnabled: false }),
      );

      await create();

      const problem = query("[data-testid='ssh-agent-setup-agent-problem']");
      expect(problem?.dataset.severity).toBe("info");
      expect(problem?.textContent).toContain("sshAgentSetupAgentOffTitleVfo7");
      expect(problem?.textContent).toContain("sshAgentSetupAgentOffDescVfo7");
      expect(query("#ssh-agent-setup_button_retry-agent")).toBeNull();
      expect(query("#ssh-agent-setup_button_close")?.getAttribute("buttonType")).toBe("primary");
      expect(queryAll("[data-testid='ssh-agent-setup-technical-details']")).toHaveLength(0);

      await click("#ssh-agent-setup_button_close");
      expect(dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it("moves on to choose by itself when the agent comes up after Try again", async () => {
      client.getEnvironment.mockResolvedValueOnce(
        automaticEnvironment({ agentRunning: false, startErrorCode: "address-in-use" }),
      );
      await create();
      expect(view()).toBe("agent-problem");

      await click("#ssh-agent-setup_button_retry-agent");

      expect(client.getEnvironment).toHaveBeenCalledTimes(2);
      expect(view()).toBe("choose");
      expect(query("[data-testid='ssh-agent-setup-agent-problem']")).toBeNull();
    });

    it("stays on the problem when the agent is still down after Try again", async () => {
      client.getEnvironment.mockResolvedValue(
        automaticEnvironment({ agentRunning: false, startErrorCode: "address-in-use" }),
      );
      await create();

      await click("#ssh-agent-setup_button_retry-agent");

      expect(view()).toBe("agent-problem");
    });

    it("keeps showing the problem when the re-check itself fails", async () => {
      client.getEnvironment.mockResolvedValueOnce(
        automaticEnvironment({ agentRunning: false, startErrorCode: "unknown" }),
      );
      await create();
      client.getEnvironment.mockRejectedValueOnce(new Error("ipc failed"));

      await click("#ssh-agent-setup_button_retry-agent");

      expect(view()).toBe("agent-problem");
    });
  });

  describe("choose view with a conflict", () => {
    beforeEach(async () => {
      await create();
    });

    it("shows a lead, the choice, what will change and the footnote in reading order", () => {
      expect(view()).toBe("choose");
      expect(text("#ssh-agent-setup_text_choose")).toBe("sshAgentSetupChooseLeadVfo7");
      const order = [
        "#ssh-agent-setup_text_choose",
        "[data-testid='ssh-agent-setup-choice']",
        "#ssh-agent-setup_text_what-will-change",
        "#ssh-agent-setup-preview_button_details",
        "[data-testid='ssh-agent-setup-footnote']",
        "#ssh-agent-setup_button_apply",
      ].map((selector) => query(selector) as Node);
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(text("[data-testid='ssh-agent-setup-footnote']")).toBe("sshAgentSetupFootnoteVfo7");
    });

    it("asks which agent to use with the same hints and Bitwarden preselected", () => {
      const choice = text("[data-testid='ssh-agent-setup-choice']");

      expect(queryAll("[data-testid='ssh-agent-setup-choice'] input[type='radio']")).toHaveLength(
        2,
      );
      expect(choice).toContain("sshAgentSetupChoiceLabelVfo7");
      expect(choice).toContain("sshAgentSetupChoiceBitwardenVfo7");
      expect(choice).toContain("sshAgentSetupChoiceBitwardenHintVfo7");
      expect(choice).toContain("sshAgentSetupChoiceCurrentVfo7");
      expect(choice).toContain("sshAgentSetupChoiceCurrentHintVfo7");
      expect(radio("bitwarden")?.checked).toBe(true);
      expect(radio("current")?.checked).toBe(false);
    });

    it("puts the radio options in one named group with a hint each", () => {
      const group = query("[data-testid='ssh-agent-setup-choice'] fieldset");
      expect(group?.querySelector("legend")?.textContent).toContain("sshAgentSetupChoiceLabelVfo7");
      expect(radio("bitwarden")?.name).toBeTruthy();
      expect(radio("bitwarden")?.name).toBe(radio("current")?.name);
      for (const id of ["bitwarden", "current"] as const) {
        const label = radio(id)?.closest("label");
        expect(label?.querySelector("bit-hint")?.textContent?.trim()).not.toBe("");
      }
    });

    it("lists one plain line per file for the current choice", async () => {
      const line = (id: string) => text(`[data-testid='ssh-agent-setup-change-${id}']`);
      expect(line("ssh-config")).toBe("sshAgentSetupChangeAddSshConfigVfo7");
      expect(line("zshrc")).toBe("sshAgentSetupChangeReplaceShellVfo7");
      expect(query("[data-testid='ssh-agent-setup-change-bashrc']")).toBeNull();
      expect(queryAll("[data-testid='ssh-agent-setup-change-list'] li")).toHaveLength(2);
      expect(queryAll("[data-testid='ssh-agent-setup-change-list'] bit-icon")).toHaveLength(0);

      await choose("current");

      expect(line("ssh-config")).toBe("sshAgentSetupChangeAddSshConfigVfo7");
      expect(line("zshrc")).toBe("sshAgentSetupChangeLeaveVfo7");
    });

    it("passes each file's path to its line", () => {
      expect(i18nService.t).toHaveBeenCalledWith(
        "sshAgentSetupChangeAddSshConfigVfo7",
        "~/.ssh/config",
        undefined,
        undefined,
      );
    });

    it("hides the exact changes until View exact changes is used", () => {
      const toggle = query("#ssh-agent-setup-preview_button_details");
      const details = query("[data-testid='ssh-agent-setup-details']");

      expect(toggle?.getAttribute("aria-expanded")).toBe("false");
      expect(toggle?.getAttribute("aria-controls")).toBe(details?.id);
      expect(details?.classList.contains("tw-hidden")).toBe(true);
      expect(toggle?.textContent).toContain("sshAgentSetupViewChangesVfo7");

      toggle?.click();
      fixture.detectChanges();

      expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      expect(details?.classList.contains("tw-hidden")).toBe(false);
      expect(toggle?.textContent).toContain("sshAgentSetupHideChangesVfo7");
      expect(details?.textContent).toContain(
        "Include ~/.ssh/bitwarden_agent.conf # Added by Bitwarden",
      );
    });

    it("holds the diffs and the conflict's existing line in the one disclosure", () => {
      const details = query("[data-testid='ssh-agent-setup-details']");
      expect(queryAll("[data-testid='ssh-agent-setup-details-toggle']")).toHaveLength(1);
      expect(details?.contains(query("[data-testid='ssh-agent-setup-diff-ssh-config']"))).toBe(
        true,
      );
      expect(details?.contains(query("[data-testid='ssh-agent-setup-diff-zshrc']"))).toBe(true);
      expect(text("[data-testid='ssh-agent-setup-diff-ssh-config']")).toContain("~/.ssh/config");
      const existing = text("[data-testid='ssh-agent-setup-existing-zshrc']");
      expect(existing).toContain("sshAgentSetupCurrentSettingLineVfo1");
      expect(existing).toContain("export SSH_AUTH_SOCK=~/.other/agent.sock");
      expect(details?.contains(query("[data-testid='ssh-agent-setup-existing-zshrc']"))).toBe(true);
    });

    it("wraps long lines instead of scrolling sideways", () => {
      const pres = queryAll("[data-testid='ssh-agent-setup-details'] pre");
      expect(pres.length).toBeGreaterThan(0);
      for (const pre of pres) {
        expect(pre.classList).toContain("tw-whitespace-pre-wrap");
        expect(pre.classList).toContain("tw-break-words");
        expect(pre.classList).not.toContain("tw-overflow-x-auto");
      }
    });

    it("shows what changes for the selected steps only", async () => {
      await choose("current");

      expect(query("[data-testid='ssh-agent-setup-diff-zshrc']")).toBeNull();
      expect(query("[data-testid='ssh-agent-setup-existing-zshrc']")).toBeNull();
      expect(query("[data-testid='ssh-agent-setup-diff-ssh-config']")).not.toBeNull();
    });

    it("shows a blocked file as a warning callout with a way to set it up by hand", () => {
      expect(query("[data-testid='ssh-agent-setup-diff-bashrc']")).toBeNull();
      const blocked = query("[data-testid='ssh-agent-setup-blocked']");
      expect(blocked).not.toBeNull();
      expect(blocked?.getAttribute("ng-reflect-type") ?? blocked?.className).toBeTruthy();
      expect(blocked?.textContent).toContain("sshAgentSetupBlockedTitleVfo7");
      expect(blocked?.textContent).toContain("sshAgentSetupBlockedSymlinkVfo7");
      expect(blocked?.textContent).toContain("sshAgentSetupManualLinkVfo7");
      expect(text("[data-testid='ssh-agent-setup-manual-bashrc']")).toContain(
        "export SSH_AUTH_SOCK=~/.bitwarden-ssh-agent.sock",
      );
      expect(i18nService.t).toHaveBeenCalledWith(
        "sshAgentSetupBlockedTitleVfo7",
        "~/.bashrc",
        undefined,
        undefined,
      );
    });

    it("uses Set up as the primary label with Cancel beside it and no Not now", () => {
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
      expect(text("#ssh-agent-setup_button_cancel")).toBe("cancel");
      expect(query("#ssh-agent-setup_button_skip")).toBeNull();
    });

    it("keeps the Set up label when Your current agent is selected", async () => {
      client.apply.mockResolvedValue([]);
      await choose("current");

      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
      expect(query("[data-testid='ssh-agent-setup-nothing-to-set-up']")).toBeNull();

      await apply();
      expect(client.apply).toHaveBeenCalledWith("plan-1", ["ssh-config"]);
    });

    it("applies only the plan id and the selected step ids", async () => {
      client.apply.mockResolvedValue([]);

      await apply();

      expect(client.apply).toHaveBeenCalledTimes(1);
      expect(client.apply).toHaveBeenCalledWith("plan-1", ["ssh-config", "zshrc"]);
    });

    it("selects the conflicting step again when the user goes back to Bitwarden", async () => {
      client.apply.mockResolvedValue([]);

      await choose("current");
      await choose("bitwarden");

      await apply();
      expect(client.apply).toHaveBeenCalledWith("plan-1", ["ssh-config", "zshrc"]);
    });

    it("closes from Cancel without verifying or changing anything", async () => {
      await click("#ssh-agent-setup_button_cancel");

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      expect(client.apply).not.toHaveBeenCalled();
      expect(client.verify).not.toHaveBeenCalled();
    });
  });

  describe("choose view without a conflict", () => {
    const shell = (id: string, path: string, status: SshAgentSetupStepStatus) => ({
      id,
      kind: SshAgentSetupStepKind.ShellProfile,
      status,
      displayPath: path,
      addedLines: ["export SSH_AUTH_SOCK=~/.bitwarden-ssh-agent.sock"],
      ...(status === SshAgentSetupStepStatus.Conflict
        ? { conflict: { existingLine: "export SSH_AUTH_SOCK=~/.other.sock", lineNumber: 3 } }
        : {}),
    });
    const sshConfig = plan().steps[0];

    it("shows no choice and applies every file from the one button", async () => {
      client.getPlan.mockResolvedValue(
        plan({
          steps: [
            sshConfig,
            shell("zshrc", "~/.zshrc", SshAgentSetupStepStatus.Pending),
            shell("bashrc", "~/.bashrc", SshAgentSetupStepStatus.Pending),
          ],
        }),
      );
      client.apply.mockResolvedValue([]);
      await create();

      expect(query("[data-testid='ssh-agent-setup-choice']")).toBeNull();
      expect(queryAll("input[type='radio']")).toHaveLength(0);
      expect(queryAll("input[type='checkbox']")).toHaveLength(0);
      expect(queryAll("[data-testid^='ssh-agent-setup-change-']:not(ul)")).toHaveLength(3);
      expect(queryAll("[data-testid^='ssh-agent-setup-diff-']")).toHaveLength(3);
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");

      await apply();

      expect(client.apply).toHaveBeenCalledWith("plan-1", ["ssh-config", "zshrc", "bashrc"]);
    });

    it("selects and clears several conflicting files together", async () => {
      client.getPlan.mockResolvedValue(
        plan({
          steps: [
            sshConfig,
            shell("zshrc", "~/.zshrc", SshAgentSetupStepStatus.Conflict),
            shell("bashrc", "~/.bashrc", SshAgentSetupStepStatus.Conflict),
          ],
        }),
      );
      client.apply.mockResolvedValue([]);
      await create();

      await apply();
      expect(client.apply).toHaveBeenLastCalledWith("plan-1", ["ssh-config", "zshrc", "bashrc"]);
    });

    it("leaves several conflicting files out with Your current agent", async () => {
      client.getPlan.mockResolvedValue(
        plan({
          steps: [
            sshConfig,
            shell("zshrc", "~/.zshrc", SshAgentSetupStepStatus.Conflict),
            shell("bashrc", "~/.bashrc", SshAgentSetupStepStatus.Conflict),
          ],
        }),
      );
      client.apply.mockResolvedValue([]);
      await create();

      await choose("current");
      await apply();

      expect(client.apply).toHaveBeenCalledWith("plan-1", ["ssh-config"]);
    });

    it("uses the same hints when the conflict is in the SSH config", async () => {
      client.getPlan.mockResolvedValue(
        plan({
          steps: [
            {
              ...sshConfig,
              status: SshAgentSetupStepStatus.Conflict,
              conflict: { existingLine: "IdentityAgent ~/.other.sock", lineNumber: 4 },
            },
            shell("zshrc", "~/.zshrc", SshAgentSetupStepStatus.Pending),
          ],
        }),
      );
      client.apply.mockResolvedValue([]);
      await create();

      const choice = () => text("[data-testid='ssh-agent-setup-choice']");
      expect(choice()).toContain("sshAgentSetupChoiceBitwardenHintVfo7");
      expect(choice()).toContain("sshAgentSetupChoiceCurrentHintVfo7");
      expect(text("[data-testid='ssh-agent-setup-change-ssh-config']")).toBe(
        "sshAgentSetupChangeReplaceSshConfigVfo7",
      );

      await choose("current");
      expect(text("[data-testid='ssh-agent-setup-change-ssh-config']")).toBe(
        "sshAgentSetupChangeLeaveVfo7",
      );
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
      await apply();
      expect(client.apply).toHaveBeenCalledWith("plan-1", ["zshrc"]);
    });
  });

  describe("nothing to change", () => {
    beforeEach(async () => {
      const sshConfig = plan().steps[0];
      client.getPlan.mockResolvedValue(
        plan({
          steps: [
            { ...sshConfig, status: SshAgentSetupStepStatus.AlreadyConfigured, addedLines: [] },
            {
              id: "zshrc",
              kind: SshAgentSetupStepKind.ShellProfile,
              status: SshAgentSetupStepStatus.Conflict,
              displayPath: "~/.zshrc",
              addedLines: ["export SSH_AUTH_SOCK=~/.bitwarden-ssh-agent.sock"],
              conflict: { existingLine: "export SSH_AUTH_SOCK=~/.other.sock", lineNumber: 3 },
            },
          ],
        }),
      );
      client.apply.mockResolvedValue([]);
      await create();
    });

    it("applies the terminal file while Bitwarden is selected", async () => {
      expect(radio("bitwarden")?.checked).toBe(true);
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
      expect(query("#ssh-agent-setup_button_done")).toBeNull();

      await apply();

      expect(client.apply).toHaveBeenCalledWith("plan-1", ["zshrc"]);
    });

    it("turns the primary button into an enabled Done with a hint when the current agent is kept", async () => {
      await choose("current");

      const done = query<HTMLButtonElement>("#ssh-agent-setup_button_done");
      const hint = query("#ssh-agent-setup_text_nothing-to-set-up");
      expect(query("#ssh-agent-setup_button_apply")).toBeNull();
      expect(done?.textContent?.trim()).toBe("done");
      expect(done?.getAttribute("aria-disabled")).not.toBe("true");
      expect(done?.disabled).toBe(false);
      expect(done?.getAttribute("aria-describedby")).toBe(hint?.id);
      expect(hint?.textContent?.trim()).toBe("sshAgentSetupNothingToChangeVfo7");
      expect(hint?.hasAttribute("aria-live")).toBe(false);
      expect(text("[data-testid='ssh-agent-setup-change-zshrc']")).toBe(
        "sshAgentSetupChangeLeaveVfo7",
      );
      expect(text("[data-testid='ssh-agent-setup-change-ssh-config']")).toBe(
        "sshAgentSetupChangeAlreadySetUpVfo7",
      );

      done?.click();
      await settle();
      expect(client.apply).not.toHaveBeenCalled();
      expect(client.verify).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledTimes(1);
    });

    it("turns Set up and the hint back on when Bitwarden is chosen again", async () => {
      await choose("current");
      await choose("bitwarden");

      expect(query("#ssh-agent-setup_button_done")).toBeNull();
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
      expect(query("#ssh-agent-setup_text_nothing-to-set-up")).toBeNull();
    });
  });

  describe("everything already set up", () => {
    it("lists the file as set up and offers Done", async () => {
      client.getPlan.mockResolvedValue(
        plan({
          steps: [
            {
              ...plan().steps[0],
              status: SshAgentSetupStepStatus.AlreadyConfigured,
              addedLines: [],
            },
          ],
        }),
      );
      await create();

      expect(text("[data-testid='ssh-agent-setup-change-ssh-config']")).toBe(
        "sshAgentSetupChangeAlreadySetUpVfo7",
      );
      expect(query("[data-testid='ssh-agent-setup-details']")).toBeNull();
      expect(query("#ssh-agent-setup_button_done")).not.toBeNull();
      expect(query("[data-testid='ssh-agent-setup-nothing-to-set-up']")).toBeNull();
    });
  });

  describe("applying", () => {
    beforeEach(async () => {
      await create();
    });

    it("swaps the body for a spinner with Applying, then Checking, and disables the footer", async () => {
      let finishApply: (value: SshAgentSetupApplyResult[]) => void = () => undefined;
      let finishVerify: (value: SshAgentVerifyResult) => void = () => undefined;
      client.apply.mockReturnValue(new Promise((r) => (finishApply = r)));
      client.verify.mockReturnValue(new Promise((r) => (finishVerify = r)));

      query<HTMLButtonElement>("#ssh-agent-setup_button_apply")?.click();
      await settle();

      expect(view()).toBe("applying");
      expect(query("app-ssh-agent-setup-preview")).toBeNull();
      expect(query("bit-spinner")).not.toBeNull();
      expect(text("[data-testid='ssh-agent-setup-verify-result']")).toContain(
        "sshAgentSetupApplyingVfo7",
      );
      expect(query("#ssh-agent-setup_button_cancel")?.getAttribute("aria-disabled")).toBe("true");
      expect(query("#ssh-agent-setup_button_apply")?.getAttribute("aria-disabled")).toBe("true");
      expect(text("#ssh-agent-setup_button_apply")).toContain("sshAgentSetupApplyingVfo7");
      expect(query("#ssh-agent-setup_button_apply")?.getAttribute("aria-busy")).toBe("true");

      finishApply([{ stepId: "ssh-config", status: SshAgentSetupStepStatus.Applied }]);
      await settle();

      expect(view()).toBe("applying");
      expect(text("[data-testid='ssh-agent-setup-verify-result']")).toContain(
        "sshAgentSetupCheckingVfo7",
      );
      expect(query("#ssh-agent-setup_button_close")?.getAttribute("aria-disabled")).toBe("true");
      expect(text("#ssh-agent-setup_button_check-again")).toContain("sshAgentSetupCheckingVfo7");

      finishVerify(allOk);
      await settle();
      expect(view()).toBe("result");
    });

    it("moves to the result and verifies after a successful apply", async () => {
      client.apply.mockResolvedValue([
        { stepId: "ssh-config", status: SshAgentSetupStepStatus.Applied },
      ]);

      await apply();

      expect(client.verify).toHaveBeenCalledTimes(1);
      expect(view()).toBe("result");
      expect(query("#ssh-agent-setup_button_done")).not.toBeNull();
      expect(query("#ssh-agent-setup_button_check-again")).toBeNull();
    });

    it("tells the user a file changed and shows the updated changes", async () => {
      client.apply.mockResolvedValue([
        {
          stepId: "ssh-config",
          status: SshAgentSetupStepStatus.Failed,
          errorCode: "changed-since-preview",
          displayPath: "~/.ssh/config",
        },
      ]);
      client.getPlan.mockResolvedValueOnce(plan({ planId: "plan-2" }));

      await apply();

      expect(view()).toBe("choose");
      expect(client.getPlan).toHaveBeenCalledTimes(2);
      const changed = query("[data-testid='ssh-agent-setup-plan-changed']");
      expect(changed?.textContent).toContain("sshAgentSetupFileChangedTitleVfo7");
      expect(changed?.textContent).toContain("sshAgentSetupFileChangedDescVfo7");
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
      expect(client.verify).not.toHaveBeenCalled();

      client.apply.mockResolvedValue([
        { stepId: "ssh-config", status: SshAgentSetupStepStatus.Applied },
      ]);
      await apply();
      expect(client.apply).toHaveBeenLastCalledWith("plan-2", ["ssh-config", "zshrc"]);
      expect(query("[data-testid='ssh-agent-setup-plan-changed']")).toBeNull();
    });

    it("treats an expired plan like a changed file and fetches a new one", async () => {
      client.apply.mockResolvedValue([
        { stepId: "ssh-config", status: SshAgentSetupStepStatus.Failed, errorCode: "plan-expired" },
      ]);
      client.getPlan.mockResolvedValueOnce(plan({ planId: "plan-2" }));

      await apply();

      expect(client.getPlan).toHaveBeenCalledTimes(2);
      expect(text("[data-testid='ssh-agent-setup-plan-changed']")).toContain(
        "sshAgentSetupFileChangedTitleVfo7",
      );
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
    });

    it("shows a danger callout on the file that failed to save and offers Try again", async () => {
      client.apply.mockResolvedValue([
        {
          stepId: "ssh-config",
          status: SshAgentSetupStepStatus.Failed,
          errorCode: "write-failed",
          displayPath: "~/.ssh/config",
          writeErrorClass: "read-only",
        },
      ]);

      await apply();

      expect(view()).toBe("choose");
      const error = query("[data-testid='ssh-agent-setup-step-error-ssh-config']");
      expect(error?.textContent).toContain("sshAgentSetupWriteFailedTitleVfo7");
      expect(error?.textContent).toContain("sshAgentSetupWriteFailedDescVfo7");
      expect(error?.textContent).toContain("sshAgentSetupWriteFailedDetailVfo7");
      expect(text("#ssh-agent-setup_button_apply")).toBe("tryAgain");
      expect(client.verify).not.toHaveBeenCalled();
    });

    it("shows a blocked result as a warning callout without asking to try again", async () => {
      client.apply.mockResolvedValue([
        {
          stepId: "ssh-config",
          status: SshAgentSetupStepStatus.Blocked,
          errorCode: "blocked",
          displayPath: "~/.ssh/config",
          blockedReasonKey: "sshAgentSetupBlockedOwner",
        },
      ]);

      await apply();

      const error = query("[data-testid='ssh-agent-setup-blocked']");
      expect(error?.textContent).toContain("sshAgentSetupBlockedTitleVfo7");
      expect(error?.textContent).toContain("sshAgentSetupBlockedOwnerVfo7");
      expect(text("#ssh-agent-setup_button_apply")).toBe("sshAgentSetupDialogSetUpButtonVfo7");
    });

    it("shows an incomplete-setup callout when apply rejects", async () => {
      client.apply.mockRejectedValue(new Error("ipc failed"));

      await apply();

      expect(view()).toBe("choose");
      expect(text("[data-testid='ssh-agent-setup-apply-failed']")).toContain(
        "sshAgentSetupIncompleteTitleVfo7",
      );
      expect(text("#ssh-agent-setup_button_apply")).toBe("tryAgain");
    });
  });

  describe("result", () => {
    const verifyText = () => text("[data-testid='ssh-agent-setup-verify-result']");
    const state = () => query("[data-testid='ssh-agent-setup-verify-result']")?.dataset.state;

    it("shows a success lockup and only a Done button", async () => {
      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(state()).toBe("success");
      expect(query("bit-status-lockup")).not.toBeNull();
      expect(verifyText()).toContain("sshAgentSetupVerifyAllSetTitleVfo7");
      expect(verifyText()).toContain("sshAgentSetupVerifyAllSetDescVfo7");
      expect(text("[data-testid='ssh-agent-setup-verify-hint']")).toBe(
        "sshAgentSetupVerifyOpenTerminalVfo7",
      );
      expect(query("[data-testid='ssh-agent-setup-verify-not-checked']")).toBeNull();
      expect(query("#ssh-agent-setup_button_done")).not.toBeNull();
      expect(query("#ssh-agent-setup_button_check-again")).toBeNull();
      expect(query("#ssh-agent-setup_button_close")).toBeNull();
      expect(query("bit-callout")).toBeNull();
    });

    it("adds the not-checked note on success when the shell was not checked", async () => {
      client.verify.mockResolvedValue({ ...allOk, shell: SshAgentVerifyOutcome.NotChecked });

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(state()).toBe("success");
      expect(text("[data-testid='ssh-agent-setup-verify-not-checked']")).toBe(
        "sshAgentSetupVerifyShellNotCheckedVfo7",
      );
    });

    it.each([
      [
        "the agent is unreachable",
        { agent: SshAgentVerifyOutcome.Unreachable },
        "sshAgentSetupVerifyNoResponseTitleVfo7",
        "check-again",
      ],
      [
        "ssh uses another agent",
        { sshClient: SshAgentVerifyOutcome.OtherAgent },
        "sshAgentSetupVerifySshOtherAgentTitleVfo7",
        "change-setup",
      ],
      [
        "ssh is not connected",
        { sshClient: SshAgentVerifyOutcome.NotConfigured },
        "sshAgentSetupVerifyNotConnectedTitleVfo7",
        "change-setup",
      ],
      [
        "new terminals use another agent",
        { shell: SshAgentVerifyOutcome.OtherAgent },
        "sshAgentSetupVerifyShellOtherAgentTitleVfo7",
        "check-again",
      ],
      [
        "new terminals are not connected",
        { shell: SshAgentVerifyOutcome.NotConfigured },
        "sshAgentSetupVerifyNotConnectedTitleVfo7",
        "change-setup",
      ],
      [
        "ssh could not be checked",
        { sshClient: SshAgentVerifyOutcome.Unreachable },
        "sshAgentSetupVerifyCheckFailedTitleVfo7",
        "check-again",
      ],
    ] as const)(
      "shows a titled callout and never a success mark when %s",
      async (_name, overrides, titleKey, action) => {
        client.verify.mockResolvedValue({ ...allOk, ...overrides });

        await create({ startAt: SshAgentSetupStartAt.Verify });

        expect(state()).toBe("failure");
        expect(verifyText()).toContain(titleKey);
        expect(verifyText()).not.toContain("sshAgentSetupVerifyAllSetTitleVfo7");
        expect(query("bit-status-lockup")).toBeNull();
        expect(query("[data-testid='ssh-agent-setup-verify-failure']")).not.toBeNull();
        expect(query("#ssh-agent-setup_button_done")).toBeNull();
        expect(query("#ssh-agent-setup_button_close")).not.toBeNull();
        if (action === "check-again") {
          expect(query("#ssh-agent-setup_button_check-again")?.getAttribute("buttonType")).toBe(
            "primary",
          );
          expect(query("#ssh-agent-setup_button_change-setup")).toBeNull();
        } else {
          expect(query("#ssh-agent-setup_button_change-setup")?.getAttribute("buttonType")).toBe(
            "primary",
          );
          expect(query("#ssh-agent-setup_button_check-again")).toBeNull();
        }
      },
    );

    it("shows technical details for the failure that has them", async () => {
      client.verify.mockResolvedValue({
        ...allOk,
        shell: SshAgentVerifyOutcome.OtherAgent,
        details: { overrideFile: "~/.zshrc", overrideLine: 12 },
      });

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(text("[data-testid='ssh-agent-setup-technical-details']")).toContain(
        "sshAgentSetupTechnicalDetailsVfo7",
      );
      expect(text("[data-testid='ssh-agent-setup-technical-details']")).toContain(
        "sshAgentSetupVerifyShellOtherAgentDetailVfo7",
      );
    });

    it("shows no technical details when there are none", async () => {
      client.verify.mockResolvedValue({ ...allOk, sshClient: SshAgentVerifyOutcome.NotConfigured });

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(query("[data-testid='ssh-agent-setup-technical-details']")).toBeNull();
    });

    it("reports only the first problem", async () => {
      client.verify.mockResolvedValue({
        ...allOk,
        sshClient: SshAgentVerifyOutcome.OtherAgent,
        shell: SshAgentVerifyOutcome.OtherAgent,
      });

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(verifyText()).toContain("sshAgentSetupVerifySshOtherAgentTitleVfo7");
      expect(verifyText()).not.toContain("sshAgentSetupVerifyShellOtherAgentTitleVfo7");
    });

    it("offers Close only when the agent is switched off", async () => {
      client.getEnvironment.mockResolvedValue(automaticEnvironment({ agentEnabled: false }));
      client.verify.mockResolvedValue({ ...allOk, agent: SshAgentVerifyOutcome.NotChecked });

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(verifyText()).toContain("sshAgentSetupAgentOffTitleVfo7");
      expect(query("#ssh-agent-setup_button_check-again")).toBeNull();
      expect(query("#ssh-agent-setup_button_change-setup")).toBeNull();
      expect(query("#ssh-agent-setup_button_close")?.getAttribute("buttonType")).toBe("primary");
    });

    it("shows a spinner while checking with Check again loading and Close disabled", async () => {
      let finish: (value: SshAgentVerifyResult) => void = () => undefined;
      client.verify.mockReturnValue(new Promise<SshAgentVerifyResult>((r) => (finish = r)));

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(state()).toBe("checking");
      expect(query("bit-spinner")).not.toBeNull();
      expect(verifyText()).toContain("sshAgentSetupCheckingVfo7");
      expect(query("#ssh-agent-setup_button_close")?.getAttribute("aria-disabled")).toBe("true");

      finish(allOk);
      await settle();

      expect(query("bit-spinner")).toBeNull();
      expect(verifyText()).toContain("sshAgentSetupVerifyAllSetTitleVfo7");
    });

    it("uses a single polite status region and hides icons from assistive technology", async () => {
      await create({ startAt: SshAgentSetupStartAt.Verify });

      const regions = queryAll("[aria-live]");
      expect(regions).toHaveLength(1);
      expect(regions[0].getAttribute("aria-live")).toBe("polite");
      expect(regions[0].getAttribute("role")).toBe("status");
      expect(regions[0].closest("app-ssh-agent-setup-verify")).not.toBeNull();
      queryAll("app-ssh-agent-setup-verify bit-icon").forEach((icon) =>
        expect(icon.getAttribute("aria-hidden")).toBe("true"),
      );
    });

    it("checks again on request, runs a new check and lands on the result heading", async () => {
      client.verify.mockResolvedValueOnce({ ...allOk, agent: SshAgentVerifyOutcome.Unreachable });
      await create({ startAt: SshAgentSetupStartAt.Verify });

      await click("#ssh-agent-setup_button_check-again");

      expect(client.verify).toHaveBeenCalledTimes(2);
      expect(verifyText()).toContain("sshAgentSetupVerifyAllSetTitleVfo7");
      expect(document.activeElement?.id).toBe("ssh-agent-setup_text_result");
    });

    it("shows a warning callout when the check can't run, with Check again as primary", async () => {
      client.verify.mockRejectedValue(new Error("ipc failed"));

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(state()).toBe("error");
      expect(verifyText()).toContain("sshAgentSetupVerifyCheckFailedTitleVfo7");
      expect(verifyText()).toContain("sshAgentSetupVerifyCheckFailedDescVfo7");
      expect(query("bit-status-lockup")).toBeNull();
      expect(query("#ssh-agent-setup_button_check-again")?.getAttribute("buttonType")).toBe(
        "primary",
      );
      expect(query("#ssh-agent-setup_button_close")).not.toBeNull();
      expect(query("#ssh-agent-setup_button_done")).toBeNull();
    });

    it("closes the dialog from Done and from Close", async () => {
      await create({ startAt: SshAgentSetupStartAt.Verify });
      expect(dialogRef.close).not.toHaveBeenCalled();

      await click("#ssh-agent-setup_button_done");

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      expect(dialogRef.close).toHaveBeenCalledWith();
    });

    it("goes back to the choose view with fresh files from Change setup", async () => {
      client.verify.mockResolvedValue({ ...allOk, sshClient: SshAgentVerifyOutcome.OtherAgent });
      await create({ startAt: SshAgentSetupStartAt.Verify });
      expect(client.getPlan).toHaveBeenCalledTimes(1);

      await click("#ssh-agent-setup_button_change-setup");

      expect(client.getPlan).toHaveBeenCalledTimes(2);
      expect(view()).toBe("choose");
      expect(query("#ssh-agent-setup_button_intro-set-up")).toBeNull();
      expect(query("app-ssh-agent-setup-preview")).not.toBeNull();
    });

    it("shows the agent problem after Change setup when the agent is down", async () => {
      client.verify.mockResolvedValue({ ...allOk, shell: SshAgentVerifyOutcome.NotConfigured });
      await create({ startAt: SshAgentSetupStartAt.Verify });
      client.getEnvironment.mockResolvedValue(
        automaticEnvironment({ agentRunning: false, startErrorCode: "unknown" }),
      );

      await click("#ssh-agent-setup_button_change-setup");

      expect(view()).toBe("agent-problem");
    });
  });

  describe("verify entry", () => {
    it("skips the intro and goes straight to checking, then the result", async () => {
      let finish: (value: SshAgentVerifyResult) => void = () => undefined;
      client.verify.mockReturnValue(new Promise<SshAgentVerifyResult>((r) => (finish = r)));

      await create({ startAt: SshAgentSetupStartAt.Verify }, { skipIntro: false });

      expect(view()).toBe("applying");
      expect(query("#ssh-agent-setup_button_intro-set-up")).toBeNull();
      expect(client.apply).not.toHaveBeenCalled();

      finish(allOk);
      await settle();
      expect(view()).toBe("result");
    });

    it("does not stop on an agent problem", async () => {
      client.getEnvironment.mockResolvedValue(
        automaticEnvironment({ agentRunning: false, startErrorCode: "unknown" }),
      );
      client.verify.mockResolvedValue({ ...allOk, agent: SshAgentVerifyOutcome.Unreachable });

      await create({ startAt: SshAgentSetupStartAt.Verify });

      expect(view()).toBe("result");
      expect(text("[data-testid='ssh-agent-setup-verify-result']")).toContain(
        "sshAgentSetupVerifyNoResponseTitleVfo7",
      );
    });

    it("shows a load error and retries into the check", async () => {
      client.getEnvironment.mockRejectedValueOnce(new Error("ipc failed"));

      await create({ startAt: SshAgentSetupStartAt.Verify });
      expect(view()).toBe("load-error");

      await click("#ssh-agent-setup_button_retry-load");

      expect(view()).toBe("result");
      expect(client.verify).toHaveBeenCalledTimes(1);
    });
  });

  describe("guided mode", () => {
    beforeEach(async () => {
      client.getEnvironment.mockResolvedValue(
        automaticEnvironment({
          platform: "windows",
          mode: SshAgentSetupMode.Guided,
          guidedReasonKey: "sshAgentSetupGuidedReasonWindows",
          socketAddress: "\\\\.\\pipe\\openssh-ssh-agent",
        }),
      );
      client.getPlan.mockResolvedValue(
        plan({
          steps: [],
          guidedCommands: [
            {
              id: "windows-service",
              command: "Stop-Service ssh-agent; Set-Service ssh-agent -StartupType Disabled",
              descriptionKey: "sshAgentSetupGuidedCommandWindowsDisableOpenSshAgent",
            },
            { id: "other", command: "echo hi", descriptionKey: "notAKnownKey" },
          ],
        }),
      );
      await create();
    });

    it("shows the guided lead, the reason, the Windows note and each command in the choose view", () => {
      expect(view()).toBe("choose");
      expect(text("#ssh-agent-setup_text_choose")).toBe("sshAgentSetupChooseLeadGuidedVfo7");
      expect(text("[data-testid='ssh-agent-setup-guided-reason']")).toContain(
        "sshAgentSetupGuidedReasonWindowsVfo1",
      );
      expect(query("[data-testid='ssh-agent-setup-windows-note']")).not.toBeNull();
      expect(text("[data-testid='ssh-agent-setup-command-windows-service']")).toContain(
        "Stop-Service ssh-agent; Set-Service ssh-agent -StartupType Disabled",
      );
      expect(text("[data-testid='ssh-agent-setup-command-other']")).toContain(
        "sshAgentSetupGuidedCmdGenericVfo1",
      );
      expect(query("app-ssh-agent-setup-preview")).toBeNull();
      expect(query("#ssh-agent-setup_button_apply")).toBeNull();
      expect(text("#ssh-agent-setup_button_continue-connect")).toBe(
        "sshAgentSetupRanStepsButtonVfo7",
      );
      expect(text("#ssh-agent-setup_button_cancel")).toBe("cancel");
    });

    it("copies a command with its copy button", () => {
      query<HTMLButtonElement>("#ssh-agent-setup-guided_button_copy-windows-service")?.click();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "Stop-Service ssh-agent; Set-Service ssh-agent -StartupType Disabled",
      );
    });

    it("never applies anything and checks the setup after I've run these", async () => {
      await click("#ssh-agent-setup_button_continue-connect");

      expect(client.apply).not.toHaveBeenCalled();
      expect(client.verify).toHaveBeenCalledTimes(1);
      expect(view()).toBe("result");
    });
  });

  describe("load error", () => {
    it("shows a titled callout with Try again and Close, and retries into the intro", async () => {
      client.getPlan.mockRejectedValueOnce(new Error("ipc failed"));
      await create({}, { skipIntro: false });

      expect(view()).toBe("load-error");
      const error = query("[data-testid='ssh-agent-setup-load-error']");
      expect(error?.textContent).toContain("sshAgentSetupLoadErrorTitleVfo7");
      expect(error?.textContent).toContain("sshAgentSetupLoadErrorDescVfo7");
      expect(query("#ssh-agent-setup_button_close")).not.toBeNull();

      await click("#ssh-agent-setup_button_retry-load");

      expect(query("[data-testid='ssh-agent-setup-load-error']")).toBeNull();
      expect(view()).toBe("intro");
      await click("#ssh-agent-setup_button_intro-set-up");
      expect(query("app-ssh-agent-setup-preview")).not.toBeNull();
    });

    it("shows a loading view with a Cancel button first", async () => {
      let finish: (value: SshAgentSetupPlan) => void = () => undefined;
      client.getPlan.mockReturnValue(new Promise<SshAgentSetupPlan>((r) => (finish = r)));

      await create({}, { skipIntro: false });

      expect(view()).toBe("loading");
      expect(query("[data-testid='ssh-agent-setup-loading']")).not.toBeNull();
      expect(query("#ssh-agent-setup_button_cancel")).not.toBeNull();

      finish(plan());
      await settle();
      expect(view()).toBe("intro");
    });
  });
});
