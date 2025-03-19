import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { NewDeviceVerificationNoticeService } from "../../services/new-device-verification-notice.service";

import { NewDeviceVerificationNoticePageTwoComponent } from "./new-device-verification-notice-page-two.component";

describe("NewDeviceVerificationNoticePageTwoComponent", () => {
  let component: NewDeviceVerificationNoticePageTwoComponent;
  let fixture: ComponentFixture<NewDeviceVerificationNoticePageTwoComponent>;

  const activeAccount$ = new BehaviorSubject({ email: "test@example.com", id: "acct-1" });
  const environment$ = new BehaviorSubject({ getWebVaultUrl: () => "vault.bitwarden.com" });
  const navigate = jest.fn().mockResolvedValue(null);
  const updateNewDeviceVerificationNoticeState = jest.fn().mockResolvedValue(null);
  const getFeatureFlag = jest.fn().mockResolvedValue(false);
  const getClientType = jest.fn().mockReturnValue(ClientType.Browser);
  const launchUri = jest.fn();

  beforeEach(async () => {
    navigate.mockClear();
    updateNewDeviceVerificationNoticeState.mockClear();
    getFeatureFlag.mockClear();
    getClientType.mockClear();
    launchUri.mockClear();

    await TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { t: (...key: string[]) => key.join(" ") } },
        { provide: Router, useValue: { navigate } },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: EnvironmentService, useValue: { environment$ } },
        {
          provide: NewDeviceVerificationNoticeService,
          useValue: { updateNewDeviceVerificationNoticeState },
        },
        { provide: PlatformUtilsService, useValue: { getClientType, launchUri } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewDeviceVerificationNoticePageTwoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("sets initial properties", () => {
    expect(component["currentUserId"]).toBe("acct-1");
    expect(component["permanentFlagEnabled"]).toBe(false);
  });

  describe("change email", () => {
    const changeEmailButton = () =>
      fixture.debugElement.query(By.css('[data-testid="change-email"]'));

    describe("web", () => {
      beforeEach(() => {
        component["isWeb"] = true;
        fixture.detectChanges();
      });

      it("navigates to settings", () => {
        changeEmailButton().nativeElement.click();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(["/settings/account"], {
          queryParams: { fromNewDeviceVerification: true },
        });
        expect(launchUri).not.toHaveBeenCalled();
      });
    });

    describe("browser/desktop", () => {
      beforeEach(() => {
        component["isWeb"] = false;
        fixture.detectChanges();
      });

      it("launches to settings", () => {
        changeEmailButton().nativeElement.click();

        expect(navigate).not.toHaveBeenCalled();
        expect(launchUri).toHaveBeenCalledWith(
          "vault.bitwarden.com/#/settings/account/?fromNewDeviceVerification=true",
        );
      });
    });
  });

  describe("enable 2fa", () => {
    const changeEmailButton = () =>
      fixture.debugElement.query(By.css('[data-testid="two-factor"]'));

    describe("web", () => {
      beforeEach(() => {
        component["isWeb"] = true;
        fixture.detectChanges();
      });

      it("navigates to two factor settings", () => {
        changeEmailButton().nativeElement.click();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(["/settings/security/two-factor"], {
          queryParams: { fromNewDeviceVerification: true },
        });
        expect(launchUri).not.toHaveBeenCalled();
      });
    });

    describe("browser/desktop", () => {
      beforeEach(() => {
        component["isWeb"] = false;
        fixture.detectChanges();
      });

      it("launches to two factor settings", () => {
        changeEmailButton().nativeElement.click();

        expect(navigate).not.toHaveBeenCalled();
        expect(launchUri).toHaveBeenCalledWith(
          "vault.bitwarden.com/#/settings/security/two-factor/?fromNewDeviceVerification=true",
        );
      });
    });
  });

  describe("remind me later", () => {
    const remindMeLater = () =>
      fixture.debugElement.query(By.css('[data-testid="remind-me-later"]'));

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-02-02T00:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("navigates to the vault", () => {
      remindMeLater().nativeElement.click();

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("updates notice state", () => {
      remindMeLater().nativeElement.click();

      expect(updateNewDeviceVerificationNoticeState).toHaveBeenCalledTimes(1);
      expect(updateNewDeviceVerificationNoticeState).toHaveBeenCalledWith("acct-1", {
        last_dismissal: new Date("2024-02-02T00:00:00.000Z"),
        permanent_dismissal: false,
      });
    });

    it("is hidden when the permanent flag is enabled", async () => {
      getFeatureFlag.mockResolvedValueOnce(true);
      await component.ngOnInit();
      fixture.detectChanges();

      expect(remindMeLater()).toBeNull();
    });
  });
});
