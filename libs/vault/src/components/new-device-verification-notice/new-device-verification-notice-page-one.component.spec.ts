import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { NewDeviceVerificationNoticeService } from "../../services/new-device-verification-notice.service";

import { NewDeviceVerificationNoticePageOneComponent } from "./new-device-verification-notice-page-one.component";

describe("NewDeviceVerificationNoticePageOneComponent", () => {
  let component: NewDeviceVerificationNoticePageOneComponent;
  let fixture: ComponentFixture<NewDeviceVerificationNoticePageOneComponent>;

  const activeAccount$ = new BehaviorSubject({ email: "test@example.com", id: "acct-1" });
  const navigate = jest.fn().mockResolvedValue(null);
  const updateNewDeviceVerificationNoticeState = jest.fn().mockResolvedValue(null);
  const getFeatureFlag = jest.fn().mockResolvedValue(null);

  beforeEach(async () => {
    navigate.mockClear();
    updateNewDeviceVerificationNoticeState.mockClear();
    getFeatureFlag.mockClear();

    await TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { t: (...key: string[]) => key.join(" ") } },
        { provide: Router, useValue: { navigate } },
        { provide: AccountService, useValue: { activeAccount$ } },
        {
          provide: NewDeviceVerificationNoticeService,
          useValue: { updateNewDeviceVerificationNoticeState },
        },
        { provide: PlatformUtilsService, useValue: { getClientType: () => false } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewDeviceVerificationNoticePageOneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("sets initial properties", () => {
    expect(component["currentEmail"]).toBe("test@example.com");
    expect(component["currentUserId"]).toBe("acct-1");
  });

  describe("temporary flag submission", () => {
    beforeEach(() => {
      getFeatureFlag.mockImplementation((key) => {
        if (key === FeatureFlag.NewDeviceVerificationTemporaryDismiss) {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      });
    });

    describe("no email access", () => {
      beforeEach(() => {
        component["formGroup"].controls.hasEmailAccess.setValue(0);
        fixture.detectChanges();

        const submit = fixture.debugElement.query(By.css('button[type="submit"]'));
        submit.nativeElement.click();
      });

      it("redirects to step two ", () => {
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(["new-device-notice/setup"]);
      });

      it("does not update notice state", () => {
        expect(getFeatureFlag).not.toHaveBeenCalled();
        expect(updateNewDeviceVerificationNoticeState).not.toHaveBeenCalled();
      });
    });

    describe("has email access", () => {
      beforeEach(() => {
        component["formGroup"].controls.hasEmailAccess.setValue(1);
        fixture.detectChanges();

        jest.useFakeTimers();
        jest.setSystemTime(new Date("2024-03-03T00:00:00.000Z"));
        const submit = fixture.debugElement.query(By.css('button[type="submit"]'));
        submit.nativeElement.click();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("redirects to the vault", () => {
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(["/vault"]);
      });

      it("updates notice state with a new date", () => {
        expect(updateNewDeviceVerificationNoticeState).toHaveBeenCalledWith("acct-1", {
          last_dismissal: new Date("2024-03-03T00:00:00.000Z"),
          permanent_dismissal: false,
        });
      });
    });
  });

  describe("permanent flag submission", () => {
    beforeEach(() => {
      getFeatureFlag.mockImplementation((key) => {
        if (key === FeatureFlag.NewDeviceVerificationPermanentDismiss) {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      });
    });

    describe("no email access", () => {
      beforeEach(() => {
        component["formGroup"].controls.hasEmailAccess.setValue(0);
        fixture.detectChanges();

        const submit = fixture.debugElement.query(By.css('button[type="submit"]'));
        submit.nativeElement.click();
      });

      it("redirects to step two", () => {
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(["new-device-notice/setup"]);
      });

      it("does not update notice state", () => {
        expect(getFeatureFlag).not.toHaveBeenCalled();
        expect(updateNewDeviceVerificationNoticeState).not.toHaveBeenCalled();
      });
    });

    describe("has email access", () => {
      beforeEach(() => {
        component["formGroup"].controls.hasEmailAccess.setValue(1);
        fixture.detectChanges();

        jest.useFakeTimers();
        jest.setSystemTime(new Date("2024-04-04T00:00:00.000Z"));
        const submit = fixture.debugElement.query(By.css('button[type="submit"]'));
        submit.nativeElement.click();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("redirects to the vault ", () => {
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(["/vault"]);
      });

      it("updates notice state with a new date", () => {
        expect(updateNewDeviceVerificationNoticeState).toHaveBeenCalledWith("acct-1", {
          last_dismissal: new Date("2024-04-04T00:00:00.000Z"),
          permanent_dismissal: true,
        });
      });
    });
  });
});
