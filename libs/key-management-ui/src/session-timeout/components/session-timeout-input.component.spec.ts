import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import { VaultTimeoutStringType } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { SessionTimeoutSettingsComponentService } from "../services/session-timeout-settings-component.service";

import { SessionTimeoutInputComponent } from "./session-timeout-input.component";

describe("SessionTimeoutInputComponent", () => {
  let component: SessionTimeoutInputComponent;
  let fixture: ComponentFixture<SessionTimeoutInputComponent>;
  const policiesByType$ = jest.fn().mockReturnValue(new BehaviorSubject({}));
  const mockUserId = Utils.newGuid() as UserId;
  const accountService = mockAccountServiceWith(mockUserId);

  const sessionTimeoutSettingsComponentService = mock<SessionTimeoutSettingsComponentService>();
  sessionTimeoutSettingsComponentService.policyFilteredTimeoutOptions$.mockImplementation(() =>
    of([
      { name: "oneMinute", value: 1 },
      { name: "fiveMinutes", value: 5 },
      { name: "fifteenMinutes", value: 15 },
      { name: "thirtyMinutes", value: 30 },
      { name: "oneHour", value: 60 },
      { name: "fourHours", value: 240 },
      { name: "onRefresh", value: VaultTimeoutStringType.OnRestart },
    ]),
  );

  const sessionTimeoutTypeService = mock<SessionTimeoutTypeService>();
  sessionTimeoutTypeService.isAvailable.mockResolvedValue(true);

  const i18nService = mock<I18nService>();
  i18nService.t.mockImplementation((key) => `${key}-used-i18n`);

  const logService = mock<LogService>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionTimeoutInputComponent],
      providers: [
        { provide: PolicyService, useValue: { policiesByType$ } },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        {
          provide: SessionTimeoutSettingsComponentService,
          useValue: sessionTimeoutSettingsComponentService,
        },
        { provide: SessionTimeoutTypeService, useValue: sessionTimeoutTypeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionTimeoutInputComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("availableTimeoutOptions", [
      { name: "oneMinute", value: 1 },
      { name: "fiveMinutes", value: 5 },
      { name: "fifteenMinutes", value: 15 },
      { name: "thirtyMinutes", value: 30 },
      { name: "oneHour", value: 60 },
      { name: "fourHours", value: 240 },
      { name: "onRefresh", value: VaultTimeoutStringType.OnRestart },
    ]);
    fixture.detectChanges();
  });

  describe("form", () => {
    beforeEach(async () => {
      await component.ngOnInit();
    });

    it("invokes the onChange associated with `ControlValueAccessor`", () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.OnRestart);

      expect(onChange).toHaveBeenCalledWith(VaultTimeoutStringType.OnRestart);
    });

    it("updates custom value to match preset option", () => {
      // 1 hour
      component.form.controls.vaultTimeout.setValue(60);

      expect(component.form.value.custom).toEqual({ hours: 1, minutes: 0 });

      // 17 minutes
      component.form.controls.vaultTimeout.setValue(17);

      expect(component.form.value.custom).toEqual({ hours: 0, minutes: 17 });

      // 2.25 hours
      component.form.controls.vaultTimeout.setValue(135);

      expect(component.form.value.custom).toEqual({ hours: 2, minutes: 15 });
    });

    it("sets custom timeout to 8 hours when a preset string option is selected", () => {
      // Set custom value to random values
      component.form.controls.custom.setValue({ hours: 1, minutes: 1 });

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.OnLocked);

      expect(component.form.value.custom).toEqual({ hours: 8, minutes: 0 });
    });
  });
});
