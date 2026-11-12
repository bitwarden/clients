import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { PamNotificationStateService } from "./pam-notification-state.service";
import { PamNotificationsSettingComponent } from "./pam-notifications-setting.component";

describe("PamNotificationsSettingComponent", () => {
  const userId = "user-1" as UserId;
  let fixture: ComponentFixture<PamNotificationsSettingComponent>;
  let flag$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<{ usePam: boolean }[]>;
  let enabled$: BehaviorSubject<boolean>;
  let stateService: { enabled$: BehaviorSubject<boolean>; setEnabled: jest.Mock };

  const checkbox = () =>
    fixture.debugElement.query(By.css("[data-testid=pam-notifications-checkbox]"));

  beforeEach(async () => {
    flag$ = new BehaviorSubject(true);
    organizations$ = new BehaviorSubject<{ usePam: boolean }[]>([{ usePam: true }]);
    enabled$ = new BehaviorSubject(true);
    stateService = { enabled$, setEnabled: jest.fn().mockResolvedValue(undefined) };
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [PamNotificationsSettingComponent],
      providers: [
        { provide: PamNotificationStateService, useValue: stateService },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => flag$ } },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) as FakeAccountService },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: I18nService, useValue: i18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PamNotificationsSettingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("shows the row when the flag is on and an organization uses PAM", () => {
    expect(checkbox()).not.toBeNull();
  });

  it("hides the row when the flag is off", () => {
    flag$.next(false);
    fixture.detectChanges();

    expect(checkbox()).toBeNull();
  });

  it("hides the row when no organization uses PAM", () => {
    organizations$.next([{ usePam: false }]);
    fixture.detectChanges();

    expect(checkbox()).toBeNull();
  });

  it("reflects the stored setting", () => {
    expect(checkbox().nativeElement.checked).toBe(true);

    enabled$.next(false);
    fixture.detectChanges();
  });

  it("saves the setting when toggled", () => {
    checkbox().nativeElement.click();

    expect(stateService.setEnabled).toHaveBeenCalledWith(false);
  });
});
