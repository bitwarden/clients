import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { AnonLayoutWrapperDataService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import * as popoutWindow from "../../popup/utils/auth-popout-window";
import { LoginWithPasskeyResultService } from "../../services/login-with-passkey-result.service";

import { LoginWithPasskeyResultComponent } from "./login-with-passkey-result.component";

describe("LoginWithPasskeyResultComponent", () => {
  let component: LoginWithPasskeyResultComponent;
  let fixture: ComponentFixture<LoginWithPasskeyResultComponent>;
  let loginWithPasskeyResultService: LoginWithPasskeyResultService;
  let validationService: ValidationService;
  let anonLayoutWrapperDataService: AnonLayoutWrapperDataService;

  let reloadOpenWindowsSpy: jest.SpyInstance;
  let closePasskeyResultPopoutSpy: jest.SpyInstance;

  const getStateText = () => fixture.nativeElement.textContent;
  const getComponentState = () => (component as any).currentState();
  const retry = () => (component as any).retry();

  beforeEach(async () => {
    loginWithPasskeyResultService = mock<LoginWithPasskeyResultService>();
    validationService = mock<ValidationService>();
    anonLayoutWrapperDataService = mock<AnonLayoutWrapperDataService>();

    reloadOpenWindowsSpy = jest.spyOn(BrowserApi, "reloadOpenWindows").mockImplementation();
    closePasskeyResultPopoutSpy = jest
      .spyOn(popoutWindow, "closePasskeyResultPopout")
      .mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [LoginWithPasskeyResultComponent, RouterTestingModule],
      providers: [
        { provide: LoginWithPasskeyResultService, useValue: loginWithPasskeyResultService },
        { provide: ValidationService, useValue: validationService },
        { provide: AnonLayoutWrapperDataService, useValue: anonLayoutWrapperDataService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginWithPasskeyResultComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("starts in the loggingIn state", () => {
    expect(getComponentState()).toBe("loggingIn");
  });

  it("calls completeLogin on init", async () => {
    (loginWithPasskeyResultService.completeLogin as jest.Mock).mockResolvedValue({
      success: true,
      userId: "user-id",
    });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(loginWithPasskeyResultService.completeLogin).toHaveBeenCalledTimes(1);
    expect(reloadOpenWindowsSpy).toHaveBeenCalledWith(true);
    expect(closePasskeyResultPopoutSpy).toHaveBeenCalled();
  });

  it("shows the failure UI and reports the error when login fails", async () => {
    (loginWithPasskeyResultService.completeLogin as jest.Mock).mockResolvedValue({
      success: false,
      errorMessage: "login-failed-message",
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComponentState()).toBe("loginFailed");
    expect(validationService.showError).toHaveBeenCalledWith("login-failed-message");
    expect(getStateText()).toContain("loginFailed");
    expect(getStateText()).toContain("passkeyLoginFailedDesc");
    expect(anonLayoutWrapperDataService.setAnonLayoutWrapperData).toHaveBeenCalled();
  });

  it("shows the failure UI for an unexpected error", async () => {
    (loginWithPasskeyResultService.completeLogin as jest.Mock).mockRejectedValue(new Error("boom"));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComponentState()).toBe("loginFailed");
    expect(validationService.showError).toHaveBeenCalledWith("invalidPasskeyPleaseTryAgain");
    expect(anonLayoutWrapperDataService.setAnonLayoutWrapperData).toHaveBeenCalled();
  });

  it("retries login when the user clicks try again", async () => {
    (loginWithPasskeyResultService.completeLogin as jest.Mock)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ success: true, userId: "user-id" });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getComponentState()).toBe("loginFailed");

    retry();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getComponentState()).toBe("loggingIn");
    expect(loginWithPasskeyResultService.completeLogin).toHaveBeenCalledTimes(2);
  });
});
