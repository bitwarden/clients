import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { BulkRevokeResult, PamApiService } from "@bitwarden/pam";

import { KillSwitchDialogComponent, KillSwitchDialogResult } from "./kill-switch-dialog.component";
import { KillSwitchComponent } from "./kill-switch.component";

describe("KillSwitchComponent", () => {
  let pamApiService: MockProxy<PamApiService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let configService: MockProxy<ConfigService>;

  beforeEach(async () => {
    pamApiService = mock<PamApiService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();
    configService = mock<ConfigService>();

    i18nService.t.mockImplementation((key: string, ...args: unknown[]) =>
      args.length > 0 ? `${key}:${args.join(",")}` : key,
    );

    await TestBed.configureTestingModule({
      imports: [KillSwitchComponent],
      providers: [
        { provide: PamApiService, useValue: pamApiService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compileComponents();
  });

  async function setup(
    opts: {
      killSwitchEnabled?: boolean;
      organizationId?: string;
      organizationName?: string;
    } = {},
  ): Promise<ComponentFixture<KillSwitchComponent>> {
    configService.getFeatureFlag$.mockReturnValue(of(opts.killSwitchEnabled ?? false));

    const fixture = TestBed.createComponent(KillSwitchComponent);
    fixture.componentRef.setInput("organizationId", opts.organizationId ?? "org-1");
    fixture.componentRef.setInput("organizationName", opts.organizationName ?? "Acme Corp");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  describe("feature-flag gating", () => {
    it("hides the kill-switch section when Pam flag is false", async () => {
      const fixture = await setup({ killSwitchEnabled: false });
      const section = fixture.nativeElement.querySelector("[data-testid='kill-switch-section']");
      expect(section).toBeNull();
    });

    it("shows the kill-switch section when Pam flag is true", async () => {
      const fixture = await setup({ killSwitchEnabled: true });
      const section = fixture.nativeElement.querySelector("[data-testid='kill-switch-section']");
      expect(section).toBeTruthy();
    });
  });

  describe("dialog interaction", () => {
    it("opens the kill-switch dialog when the button is clicked", async () => {
      const openSpy = jest.spyOn(KillSwitchDialogComponent, "open");
      openSpy.mockReturnValue({ closed: of(KillSwitchDialogResult.Canceled) } as any);

      const fixture = await setup({ killSwitchEnabled: true });
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        "#kill-switch_button_open-dialog",
      );
      button.click();
      await fixture.whenStable();

      expect(openSpy).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ data: { organizationName: "Acme Corp" } }),
      );
    });

    it("does not call bulkRevokeLeases when dialog is canceled", async () => {
      const openSpy = jest.spyOn(KillSwitchDialogComponent, "open");
      openSpy.mockReturnValue({ closed: of(KillSwitchDialogResult.Canceled) } as any);

      const fixture = await setup({ killSwitchEnabled: true });
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        "#kill-switch_button_open-dialog",
      );
      button.click();
      await fixture.whenStable();

      expect(pamApiService.bulkRevokeLeases).not.toHaveBeenCalled();
    });
  });

  describe("success state", () => {
    it("shows the success callout after a successful bulk revoke", async () => {
      const openSpy = jest.spyOn(KillSwitchDialogComponent, "open");
      openSpy.mockReturnValue({ closed: of(KillSwitchDialogResult.Confirmed) } as any);
      const result: BulkRevokeResult = { kind: "ok", revokedCount: 7 };
      pamApiService.bulkRevokeLeases.mockResolvedValue(result);

      const fixture = await setup({ killSwitchEnabled: true });
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        "#kill-switch_button_open-dialog",
      );
      button.click();
      await fixture.whenStable();
      fixture.detectChanges();

      const callout = fixture.nativeElement.querySelector(
        "[data-testid='kill-switch-success-callout']",
      );
      expect(callout).toBeTruthy();
      // The block-new-leases toggle defaults to off; the kill switch passes it through.
      expect(pamApiService.bulkRevokeLeases).toHaveBeenCalledWith("org-1", false);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  describe("partial-failure state", () => {
    it("shows the partial callout after a partial bulk revoke", async () => {
      const openSpy = jest.spyOn(KillSwitchDialogComponent, "open");
      openSpy.mockReturnValue({ closed: of(KillSwitchDialogResult.Confirmed) } as any);
      const result: BulkRevokeResult = {
        kind: "partial",
        revokedCount: 5,
        failedCount: 2,
      };
      pamApiService.bulkRevokeLeases.mockResolvedValue(result);

      const fixture = await setup({ killSwitchEnabled: true });
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        "#kill-switch_button_open-dialog",
      );
      button.click();
      await fixture.whenStable();
      fixture.detectChanges();

      const callout = fixture.nativeElement.querySelector(
        "[data-testid='kill-switch-partial-callout']",
      );
      expect(callout).toBeTruthy();
    });
  });

  describe("error handling", () => {
    it("shows an error toast and logs the error when bulkRevokeLeases throws", async () => {
      const openSpy = jest.spyOn(KillSwitchDialogComponent, "open");
      openSpy.mockReturnValue({ closed: of(KillSwitchDialogResult.Confirmed) } as any);
      const err = new Error("network error");
      pamApiService.bulkRevokeLeases.mockRejectedValue(err);

      const fixture = await setup({ killSwitchEnabled: true });
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        "#kill-switch_button_open-dialog",
      );
      button.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(logService.error).toHaveBeenCalledWith(err);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      const successCallout = fixture.nativeElement.querySelector(
        "[data-testid='kill-switch-success-callout']",
      );
      expect(successCallout).toBeNull();
    });
  });
});
