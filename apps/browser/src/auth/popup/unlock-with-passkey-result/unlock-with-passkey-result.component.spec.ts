import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { AnonLayoutWrapperDataService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import * as popoutWindow from "../../popup/utils/auth-popout-window";
import { UnlockWithPasskeyResultService } from "../../services/unlock-with-passkey-result.service";

import { UnlockWithPasskeyResultComponent } from "./unlock-with-passkey-result.component";

describe("UnlockWithPasskeyResultComponent", () => {
  let component: UnlockWithPasskeyResultComponent;
  let fixture: ComponentFixture<UnlockWithPasskeyResultComponent>;
  let unlockWithPasskeyResultService: UnlockWithPasskeyResultService;
  let validationService: ValidationService;
  let anonLayoutWrapperDataService: AnonLayoutWrapperDataService;
  let router: Router;

  let reloadOpenWindowsSpy: jest.SpyInstance;
  let closePasskeyResultPopoutSpy: jest.SpyInstance;
  let routerNavigateSpy: jest.SpyInstance;

  const getStateText = () => fixture.nativeElement.textContent;
  const getComponentState = () => (component as any).currentState();
  const retry = () => (component as any).retry();

  beforeEach(async () => {
    unlockWithPasskeyResultService = mock<UnlockWithPasskeyResultService>();
    validationService = mock<ValidationService>();
    anonLayoutWrapperDataService = mock<AnonLayoutWrapperDataService>();

    reloadOpenWindowsSpy = jest.spyOn(BrowserApi, "reloadOpenWindows").mockImplementation();
    closePasskeyResultPopoutSpy = jest
      .spyOn(popoutWindow, "closePasskeyResultPopout")
      .mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [UnlockWithPasskeyResultComponent, RouterTestingModule],
      providers: [
        { provide: UnlockWithPasskeyResultService, useValue: unlockWithPasskeyResultService },
        { provide: ValidationService, useValue: validationService },
        { provide: AnonLayoutWrapperDataService, useValue: anonLayoutWrapperDataService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UnlockWithPasskeyResultComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    routerNavigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("starts in the unlocking state", () => {
    expect(getComponentState()).toBe("unlocking");
  });

  it("calls completeUnlock on init and navigates to the vault on success", async () => {
    (unlockWithPasskeyResultService.completeUnlock as jest.Mock).mockResolvedValue({
      success: true,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(unlockWithPasskeyResultService.completeUnlock).toHaveBeenCalledTimes(1);
    expect(reloadOpenWindowsSpy).toHaveBeenCalledWith(true);
    expect(closePasskeyResultPopoutSpy).toHaveBeenCalled();
    expect(routerNavigateSpy).toHaveBeenCalledWith(["/tabs/vault"]);
  });

  it("closes the popout without showing an error when unlock is canceled", async () => {
    (unlockWithPasskeyResultService.completeUnlock as jest.Mock).mockResolvedValue({
      success: false,
      errorMessage: "",
      canceled: true,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComponentState()).toBe("unlocking");
    expect(validationService.showError).not.toHaveBeenCalled();
    expect(closePasskeyResultPopoutSpy).toHaveBeenCalled();
    expect(reloadOpenWindowsSpy).not.toHaveBeenCalled();
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it("shows the failure UI and reports the error when unlock fails", async () => {
    (unlockWithPasskeyResultService.completeUnlock as jest.Mock).mockResolvedValue({
      success: false,
      errorMessage: "unlock-failed-message",
      canceled: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComponentState()).toBe("unlockFailed");
    expect(validationService.showError).toHaveBeenCalledWith("unlock-failed-message");
    expect(getStateText()).toContain("unlockFailed");
    expect(getStateText()).toContain("passkeyUnlockFailedDesc");
    expect(anonLayoutWrapperDataService.setAnonLayoutWrapperData).toHaveBeenCalled();
  });

  it("shows the failure UI for an unexpected error", async () => {
    (unlockWithPasskeyResultService.completeUnlock as jest.Mock).mockRejectedValue(
      new Error("boom"),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComponentState()).toBe("unlockFailed");
    expect(validationService.showError).toHaveBeenCalledWith("invalidPasskeyPleaseTryAgain");
  });

  it("retries unlock when the user clicks try again", async () => {
    (unlockWithPasskeyResultService.completeUnlock as jest.Mock)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ success: true });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComponentState()).toBe("unlockFailed");

    retry();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getComponentState()).toBe("unlocking");
    expect(unlockWithPasskeyResultService.completeUnlock).toHaveBeenCalledTimes(2);
  });
});
