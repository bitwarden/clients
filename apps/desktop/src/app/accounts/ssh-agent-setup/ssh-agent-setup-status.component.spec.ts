import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import {
  SshAgentSetupOverallStatus,
  SshAgentSetupStepStatus,
} from "../../../autofill/models/ssh-agent-setup";

import {
  SshAgentSetupDialogComponent,
  SshAgentSetupStartAt,
} from "./ssh-agent-setup-dialog.component";
import { SshAgentSetupStatusComponent } from "./ssh-agent-setup-status.component";
import { SSH_AGENT_HELP_URL } from "./ssh-agent-setup-text";
import { SshAgentSetupClient } from "./ssh-agent-setup.client";

describe("SshAgentSetupStatusComponent", () => {
  let fixture: ComponentFixture<SshAgentSetupStatusComponent>;
  let component: SshAgentSetupStatusComponent;
  let client: MockProxy<SshAgentSetupClient>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  const query = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
    fixture.nativeElement.querySelector(selector);

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  };

  const create = async (status: SshAgentSetupOverallStatus, agentEnabled = true) => {
    client.getStatus.mockResolvedValue(status);
    fixture = TestBed.createComponent(SshAgentSetupStatusComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("agentEnabled", agentEnabled);
    fixture.detectChanges();
    await settle();
  };

  beforeEach(async () => {
    client = mock<SshAgentSetupClient>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    platformUtilsService = mock<PlatformUtilsService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    const dialogRef = mock<DialogRef<void>>();
    Object.defineProperty(dialogRef, "closed", { value: of(undefined) });
    dialogService.open.mockReturnValue(dialogRef);

    await TestBed.configureTestingModule({
      imports: [SshAgentSetupStatusComponent],
      providers: [
        { provide: SshAgentSetupClient, useValue: client },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
      ],
    }).compileComponents();
  });

  const expectSetupOpened = (startAt: SshAgentSetupStartAt) =>
    expect(dialogService.open).toHaveBeenCalledWith(SshAgentSetupDialogComponent, {
      data: { startAt },
    });

  describe("visibility", () => {
    it("is hidden and does not check status while the agent is off", async () => {
      await create(SshAgentSetupOverallStatus.NotConfigured, false);

      expect(fixture.nativeElement.hasAttribute("hidden")).toBe(true);
      expect(client.getStatus).not.toHaveBeenCalled();
    });

    it("checks status when the agent is on", async () => {
      await create(SshAgentSetupOverallStatus.NotConfigured);

      expect(fixture.nativeElement.hasAttribute("hidden")).toBe(false);
      expect(client.getStatus).toHaveBeenCalled();
    });
  });

  describe("auto open after enabling the agent", () => {
    it("opens setup once when the device is not set up", async () => {
      await create(SshAgentSetupOverallStatus.NotConfigured);

      await component.offerSetupAfterEnable(true);
      await component.offerSetupAfterEnable(false);
      await component.offerSetupAfterEnable(true);

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expectSetupOpened(SshAgentSetupStartAt.Connect);
    });

    it.each([SshAgentSetupOverallStatus.Partial, SshAgentSetupOverallStatus.Conflict])(
      "opens setup when the status is %s",
      async (status) => {
        await create(status);

        await component.offerSetupAfterEnable(true);

        expectSetupOpened(SshAgentSetupStartAt.Connect);
      },
    );

    it.each([SshAgentSetupOverallStatus.Configured, SshAgentSetupOverallStatus.Unsupported])(
      "does not open setup when the status is %s",
      async (status) => {
        await create(status);

        await component.offerSetupAfterEnable(true);

        expect(dialogService.open).not.toHaveBeenCalled();
      },
    );

    it("does nothing when the agent was turned off", async () => {
      await create(SshAgentSetupOverallStatus.NotConfigured);
      client.getStatus.mockClear();

      await component.offerSetupAfterEnable(false);

      expect(client.getStatus).not.toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("does not open when the status can't be read", async () => {
      await create(SshAgentSetupOverallStatus.NotConfigured);
      client.getStatus.mockRejectedValue(new Error("ipc failed"));

      await component.offerSetupAfterEnable(true);

      expect(dialogService.open).not.toHaveBeenCalled();
    });
  });

  describe("row actions", () => {
    it("shows Not set up with a Set up button that opens the flow", async () => {
      await create(SshAgentSetupOverallStatus.NotConfigured);

      expect(query("[data-testid='ssh-agent-setup-status-badge']")?.textContent).toContain(
        "sshAgentSetupStatusNotSetUpVfo1",
      );

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_set-up")?.click();
      await settle();

      expectSetupOpened(SshAgentSetupStartAt.Connect);
      // Status is refreshed after the flow closes.
      expect(client.getStatus).toHaveBeenCalledTimes(2);
    });

    it("returns focus to the row's main action after the flow closes", async () => {
      await create(SshAgentSetupOverallStatus.NotConfigured);
      client.getStatus.mockResolvedValue(SshAgentSetupOverallStatus.Configured);

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_set-up")?.click();
      await settle();

      expect(document.activeElement?.id).toBe("ssh-agent-setup-status_button_check-again");
    });

    it("shows Check again and Remove setup when set up", async () => {
      await create(SshAgentSetupOverallStatus.Configured);

      expect(query("[data-testid='ssh-agent-setup-status-badge']")?.textContent).toContain(
        "sshAgentSetupStatusSetUpVfo1",
      );
      expect(query("#ssh-agent-setup-status_button_remove")).not.toBeNull();

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_check-again")?.click();
      await settle();

      expectSetupOpened(SshAgentSetupStartAt.Verify);
    });

    it("explains a conflict and offers a review", async () => {
      await create(SshAgentSetupOverallStatus.Conflict);

      expect(fixture.nativeElement.textContent).toContain("sshAgentSetupStatusConflictDescVfo1");
      query<HTMLButtonElement>("#ssh-agent-setup-status_button_review")?.click();
      await settle();

      expectSetupOpened(SshAgentSetupStartAt.Connect);
    });

    it("links to help when setup isn't available", async () => {
      await create(SshAgentSetupOverallStatus.Unsupported);

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_learn-more")?.click();

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(SSH_AGENT_HELP_URL);
    });

    it("offers a retry when the status can't be read", async () => {
      client.getStatus.mockRejectedValueOnce(new Error("ipc failed"));
      fixture = TestBed.createComponent(SshAgentSetupStatusComponent);
      fixture.componentRef.setInput("agentEnabled", true);
      fixture.detectChanges();
      await settle();

      expect(fixture.nativeElement.textContent).toContain("sshAgentSetupStatusErrorDescVfo7");
      const badge = query("[data-testid='ssh-agent-setup-status-badge']");
      expect(badge?.textContent).toContain("sshAgentSetupStatusErrorVfo7");
      expect(badge?.className).toContain("tw-bg-bg-warning-soft");

      client.getStatus.mockResolvedValue(SshAgentSetupOverallStatus.Configured);
      query<HTMLButtonElement>("#ssh-agent-setup-status_button_retry")?.click();
      await settle();

      expect(query("#ssh-agent-setup-status_button_check-again")).not.toBeNull();
    });
  });

  describe("remove setup", () => {
    it("asks for confirmation, then undoes and confirms with a toast", async () => {
      await create(SshAgentSetupOverallStatus.Configured);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      client.undo.mockResolvedValue([
        { stepId: "ssh-config", status: SshAgentSetupStepStatus.Pending },
      ]);

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_remove")?.click();
      await settle();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "sshAgentSetupRemoveTitleVfo1" },
          content: { key: "sshAgentSetupRemoveDescVfo1" },
          type: "warning",
        }),
      );
      expect(client.undo).toHaveBeenCalledTimes(1);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "sshAgentSetupRemovedToastVfo1",
      });
    });

    it("does nothing when the user cancels", async () => {
      await create(SshAgentSetupOverallStatus.Configured);
      dialogService.openSimpleDialog.mockResolvedValue(false);

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_remove")?.click();
      await settle();

      expect(client.undo).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("reports a failed removal", async () => {
      await create(SshAgentSetupOverallStatus.Partial);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      client.undo.mockResolvedValue([
        {
          stepId: "ssh-config",
          status: SshAgentSetupStepStatus.Failed,
          errorCode: "write-failed",
        },
      ]);

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_remove")?.click();
      await settle();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "sshAgentSetupRemoveFailedToastVfo7",
      });
    });

    it("refreshes the row after a failed removal", async () => {
      await create(SshAgentSetupOverallStatus.Configured);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      client.undo.mockRejectedValue(new Error("ipc failed"));
      client.getStatus.mockClear();
      client.getStatus.mockResolvedValue(SshAgentSetupOverallStatus.Partial);

      query<HTMLButtonElement>("#ssh-agent-setup-status_button_remove")?.click();
      await settle();

      expect(client.getStatus).toHaveBeenCalledTimes(1);
      expect(query("[data-testid='ssh-agent-setup-status']")?.getAttribute("data-state")).toBe(
        SshAgentSetupOverallStatus.Partial,
      );
      expect(query("#ssh-agent-setup-status_button_finish")).not.toBeNull();
    });
  });
});
