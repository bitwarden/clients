import { ComponentFixture, fakeAsync, flush, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  MaximumSessionTimeoutPolicyData,
  SessionTimeoutTypeService,
} from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { SessionTimeoutSettingsComponentService } from "../services/session-timeout-settings-component.service";

import { SessionTimeoutInputComponent } from "./session-timeout-input.component";

describe("SessionTimeoutInputComponent", () => {
  let component: SessionTimeoutInputComponent;
  let fixture: ComponentFixture<SessionTimeoutInputComponent>;

  // Test constants
  const MOCK_USER_ID = "user-id" as UserId;
  const ONE_MINUTE = 1;
  const FIVE_MINUTES = 5;
  const FIFTEEN_MINUTES = 15;
  const THIRTY_MINUTES = 30;
  const ONE_HOUR = 60;
  const FOUR_HOURS = 240;
  const NINETY_MINUTES = 90;

  // Mock services
  let mockPolicyService: MockProxy<PolicyService>;
  let mockSessionTimeoutSettingsComponentService: MockProxy<SessionTimeoutSettingsComponentService>;
  let mockSessionTimeoutTypeService: MockProxy<SessionTimeoutTypeService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockLogService: MockProxy<LogService>;
  let accountService: AccountService;

  // BehaviorSubjects for reactive testing
  let policies$: BehaviorSubject<Policy[]>;
  let availableTimeoutOptions: VaultTimeoutOption[];

  beforeEach(async () => {
    // Initialize BehaviorSubjects
    policies$ = new BehaviorSubject<Policy[]>([]);

    // Initialize available timeout options
    availableTimeoutOptions = [
      { name: "oneMinute-used-i18n", value: ONE_MINUTE },
      { name: "fiveMinutes-used-i18n", value: FIVE_MINUTES },
      { name: "fifteenMinutes-used-i18n", value: FIFTEEN_MINUTES },
      { name: "thirtyMinutes-used-i18n", value: THIRTY_MINUTES },
      { name: "oneHour-used-i18n", value: ONE_HOUR },
      { name: "fourHours-used-i18n", value: FOUR_HOURS },
      { name: "onRestart-used-i18n", value: VaultTimeoutStringType.OnRestart },
      { name: "onLocked-used-i18n", value: VaultTimeoutStringType.OnLocked },
      { name: "never-used-i18n", value: VaultTimeoutStringType.Never },
    ];

    // Initialize mocks
    mockPolicyService = mock<PolicyService>();
    mockPolicyService.policiesByType$.mockReturnValue(policies$.asObservable());

    accountService = mockAccountServiceWith(MOCK_USER_ID);

    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key, ...args) => {
      if (args.length > 0) {
        return `${key}-used-i18n-${args.join("-")}`;
      }
      return `${key}-used-i18n`;
    });

    mockLogService = mock<LogService>();

    mockSessionTimeoutSettingsComponentService = mock<SessionTimeoutSettingsComponentService>();
    mockSessionTimeoutSettingsComponentService.policyFilteredTimeoutOptions$.mockReturnValue(
      of(availableTimeoutOptions),
    );

    mockSessionTimeoutTypeService = mock<SessionTimeoutTypeService>();
    mockSessionTimeoutTypeService.isAvailable.mockResolvedValue(true);
    mockSessionTimeoutTypeService.getOrPromoteToAvailable.mockImplementation(
      async (timeout: VaultTimeout) => timeout,
    );

    await TestBed.configureTestingModule({
      imports: [SessionTimeoutInputComponent],
      providers: [
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        {
          provide: SessionTimeoutSettingsComponentService,
          useValue: mockSessionTimeoutSettingsComponentService,
        },
        { provide: SessionTimeoutTypeService, useValue: mockSessionTimeoutTypeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionTimeoutInputComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("availableTimeoutOptions", availableTimeoutOptions);
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    describe("policy data subscription and initialization", () => {
      it("should initialize maxSessionTimeoutPolicyData to null when no policy exists", fakeAsync(() => {
        fixture.detectChanges();
        flush();

        expect(component["maxSessionTimeoutPolicyData"]).toBeNull();
      }));

      it("should set maxSessionTimeoutPolicyData when policy exists", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "custom",
          minutes: NINETY_MINUTES,
        };

        fixture.detectChanges();
        flush();

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
        flush();

        expect(component["maxSessionTimeoutPolicyData"]).toEqual(policyData);
      }));

      it("should trigger validatorChange callback when policy data changes", fakeAsync(() => {
        const validatorChangeFn = jest.fn();
        component.registerOnValidatorChange(validatorChangeFn);

        fixture.detectChanges();
        flush();

        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "custom",
          minutes: NINETY_MINUTES,
        };
        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
        flush();

        expect(validatorChangeFn).toHaveBeenCalled();
      }));

      it("should update form validation when policy data changes", fakeAsync(() => {
        const updateSpy = jest.spyOn(component.form.controls.custom, "updateValueAndValidity");

        fixture.detectChanges();
        flush();

        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "custom",
          minutes: FIFTEEN_MINUTES,
        };
        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
        flush();

        expect(updateSpy).toHaveBeenCalled();
      }));
    });

    describe("policyTimeoutMessage$ observable", () => {
      it("should emit custom timeout message when policy has custom type", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "custom",
          minutes: NINETY_MINUTES,
        };

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = null;
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBe(
          "sessionTimeoutSettingsPolicySetMaximumTimeoutToHoursMinutes-used-i18n-1-30",
        );
      }));

      it("should emit immediately message when policy has immediately type", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "immediately",
          minutes: 0,
        };

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = null;
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBe(
          "sessionTimeoutSettingsPolicySetDefaultTimeoutToImmediately-used-i18n",
        );
      }));

      it("should emit onLocked message when policy has onSystemLock type", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "onSystemLock",
          minutes: 0,
        };

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = null;
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBe("sessionTimeoutSettingsPolicySetDefaultTimeoutToOnLocked-used-i18n");
      }));

      it("should emit onRestart message when policy has onAppRestart type", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "onAppRestart",
          minutes: 0,
        };

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = null;
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBe(
          "sessionTimeoutSettingsPolicySetDefaultTimeoutToOnAppRestart-used-i18n",
        );
      }));

      it("should emit null when policy has never type and promoted value is Never", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "never",
          minutes: 0,
        };

        mockSessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(
          VaultTimeoutStringType.Never,
        );

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = "initial";
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBeNull();
      }));

      it("should emit numeric timeout message when immediately is promoted to 1 minute", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "immediately",
          minutes: 0,
        };

        mockSessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(ONE_MINUTE);

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = null;
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBe(
          "sessionTimeoutSettingsPolicySetMaximumTimeoutToHoursMinutes-used-i18n-0-1",
        );
      }));

      it("should emit onRestart message when onSystemLock is promoted to OnRestart", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "onSystemLock",
          minutes: 0,
        };

        mockSessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(
          VaultTimeoutStringType.OnRestart,
        );

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = null;
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBe(
          "sessionTimeoutSettingsPolicySetDefaultTimeoutToOnAppRestart-used-i18n",
        );
      }));

      it("should emit onRestart message when never is promoted to OnRestart", fakeAsync(() => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "never",
          minutes: 0,
        };

        mockSessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(
          VaultTimeoutStringType.OnRestart,
        );

        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);

        fixture.detectChanges();
        flush();

        let message: string | null = null;
        component["policyTimeoutMessage$"].subscribe((msg) => (message = msg));
        flush();

        expect(message).toBe(
          "sessionTimeoutSettingsPolicySetDefaultTimeoutToOnAppRestart-used-i18n",
        );
      }));
    });

    describe("form value changes subscription", () => {
      it("should call onChange with vault timeout when form is valid and in custom mode", fakeAsync(() => {
        const onChange = jest.fn();
        component.registerOnChange(onChange);

        fixture.detectChanges();
        flush();

        component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
        component.form.controls.custom.setValue({ hours: 1, minutes: 30 });
        flush();

        expect(onChange).toHaveBeenCalledWith(NINETY_MINUTES);
      }));

      it("should call onChange when form changes to non-custom mode", fakeAsync(() => {
        const onChange = jest.fn();
        component.registerOnChange(onChange);

        fixture.detectChanges();
        flush();

        onChange.mockClear();

        component.form.controls.vaultTimeout.setValue(FIFTEEN_MINUTES);
        flush();

        expect(onChange).toHaveBeenCalledWith(FIFTEEN_MINUTES);
      }));

      it("should not call onChange when custom controls are invalid", fakeAsync(() => {
        const onChange = jest.fn();
        component.registerOnChange(onChange);

        fixture.detectChanges();
        flush();

        component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
        flush();

        onChange.mockClear();

        component.form.controls.custom.controls.hours.setValue(null);
        flush();

        expect(onChange).not.toHaveBeenCalled();
      }));

      it("should not call onChange when vaultTimeout is null", fakeAsync(() => {
        const onChange = jest.fn();
        component.registerOnChange(onChange);

        fixture.detectChanges();
        flush();

        onChange.mockClear();

        component.form.controls.vaultTimeout.setValue(null);
        flush();

        expect(onChange).not.toHaveBeenCalled();
      }));
    });

    describe("custom fields initialization from vaultTimeout changes", () => {
      it("should update custom fields when vaultTimeout changes to numeric value", fakeAsync(() => {
        fixture.detectChanges();
        flush();

        component.form.controls.vaultTimeout.setValue(NINETY_MINUTES);
        flush();

        expect(component.form.value.custom).toEqual({ hours: 1, minutes: 30 });
      }));

      it.each([
        VaultTimeoutStringType.OnRestart,
        VaultTimeoutStringType.OnLocked,
        VaultTimeoutStringType.Never,
        VaultTimeoutStringType.OnSleep,
        VaultTimeoutStringType.OnIdle,
      ])(
        "should set custom fields to 8 hours when vaultTimeout changes to %s",
        fakeAsync((timeoutType: VaultTimeout) => {
          fixture.detectChanges();
          flush();

          component.form.controls.custom.setValue({ hours: 1, minutes: 30 });
          component.form.controls.vaultTimeout.setValue(timeoutType);
          flush();

          expect(component.form.value.custom).toEqual({ hours: 8, minutes: 0 });
        }),
      );

      it("should mark custom fields as touched after update", fakeAsync(() => {
        fixture.detectChanges();
        flush();

        component.form.controls.vaultTimeout.setValue(ONE_HOUR);
        flush();

        expect(component.form.controls.custom.controls.hours.touched).toBe(true);
        expect(component.form.controls.custom.controls.minutes.touched).toBe(true);
      }));

      it("should not update custom fields when vaultTimeout changes to Custom", fakeAsync(() => {
        fixture.detectChanges();
        flush();

        component.form.controls.custom.setValue({ hours: 5, minutes: 15 });

        component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
        flush();

        expect(component.form.value.custom).toEqual({ hours: 5, minutes: 15 });
      }));
    });
  });

  describe("isCustomTimeoutType", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
    }));

    it("should return true when vaultTimeout is Custom", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      flush();

      expect(component.isCustomTimeoutType).toBe(true);
    }));

    it.each([
      ONE_MINUTE,
      FIFTEEN_MINUTES,
      ONE_HOUR,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.OnLocked,
      VaultTimeoutStringType.Never,
    ])(
      "should return false when vaultTimeout is %s",
      fakeAsync((timeout: VaultTimeout) => {
        component.form.controls.vaultTimeout.setValue(timeout);
        flush();

        expect(component.isCustomTimeoutType).toBe(false);
      }),
    );
  });

  describe("customMinutesMin", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
    }));

    it("should return 1 when hours is 0", fakeAsync(() => {
      component.form.controls.custom.controls.hours.setValue(0);
      flush();

      expect(component.customMinutesMin).toBe(1);
    }));

    it.each([1, 2, 5, 10])(
      "should return 0 when hours is %s",
      fakeAsync((hours: number) => {
        component.form.controls.custom.controls.hours.setValue(hours);
        flush();

        expect(component.customMinutesMin).toBe(0);
      }),
    );
  });

  describe("maxSessionTimeoutPolicyHours", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
    }));

    it("should return 0 when no policy exists", fakeAsync(() => {
      expect(component.maxSessionTimeoutPolicyHours).toBe(0);
    }));

    it.each([
      { minutes: ONE_HOUR, expectedHours: 1 },
      { minutes: NINETY_MINUTES, expectedHours: 1 },
      { minutes: FOUR_HOURS, expectedHours: 4 },
      { minutes: 300, expectedHours: 5 },
    ])(
      "should return $expectedHours when policy minutes is $minutes",
      fakeAsync(({ minutes, expectedHours }: { minutes: number; expectedHours: number }) => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "custom",
          minutes,
        };
        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
        flush();

        expect(component.maxSessionTimeoutPolicyHours).toBe(expectedHours);
      }),
    );
  });

  describe("maxSessionTimeoutPolicyMinutes", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
    }));

    it("should return 0 when no policy exists", fakeAsync(() => {
      expect(component.maxSessionTimeoutPolicyMinutes).toBe(0);
    }));

    it.each([
      { minutes: ONE_HOUR, expectedMinutes: 0 },
      { minutes: NINETY_MINUTES, expectedMinutes: 30 },
      { minutes: 65, expectedMinutes: 5 },
      { minutes: 137, expectedMinutes: 17 },
    ])(
      "should return $expectedMinutes when policy minutes is $minutes",
      fakeAsync(({ minutes, expectedMinutes }: { minutes: number; expectedMinutes: number }) => {
        const policyData: MaximumSessionTimeoutPolicyData = {
          type: "custom",
          minutes,
        };
        policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
        flush();

        expect(component.maxSessionTimeoutPolicyMinutes).toBe(expectedMinutes);
      }),
    );
  });

  describe("exceedsPolicyMaximumTimeout", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
    }));

    it("should return true when custom timeout exceeds policy maximum", fakeAsync(() => {
      const policyData: MaximumSessionTimeoutPolicyData = {
        type: "custom",
        minutes: ONE_HOUR,
      };
      policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
      flush();

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 2, minutes: 0 });
      flush();

      expect(component.exceedsPolicyMaximumTimeout).toBe(true);
    }));

    it("should return false when no policy exists", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 100, minutes: 0 });
      flush();

      expect(component.exceedsPolicyMaximumTimeout).toBe(false);
    }));

    it("should return false when policy type is not custom", fakeAsync(() => {
      const policyData: MaximumSessionTimeoutPolicyData = {
        type: "immediately",
        minutes: 0,
      };
      policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
      flush();

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 10, minutes: 0 });
      flush();

      expect(component.exceedsPolicyMaximumTimeout).toBe(false);
    }));

    it("should return false when policy type is custom and form timeout is not custom", fakeAsync(() => {
      const policyData: MaximumSessionTimeoutPolicyData = {
        type: "custom",
        minutes: FIFTEEN_MINUTES,
      };
      policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
      flush();

      component.form.controls.vaultTimeout.setValue(ONE_HOUR);
      flush();

      expect(component.exceedsPolicyMaximumTimeout).toBe(false);
    }));

    it("should return false when custom timeout equals policy maximum", fakeAsync(() => {
      const policyData: MaximumSessionTimeoutPolicyData = {
        type: "custom",
        minutes: ONE_HOUR,
      };
      policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
      flush();

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 1, minutes: 0 });
      flush();

      expect(component.exceedsPolicyMaximumTimeout).toBe(false);
    }));

    it("should return false when custom timeout is below policy maximum", fakeAsync(() => {
      const policyData: MaximumSessionTimeoutPolicyData = {
        type: "custom",
        minutes: FOUR_HOURS,
      };
      policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
      flush();

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 2, minutes: 30 });
      flush();

      expect(component.exceedsPolicyMaximumTimeout).toBe(false);
    }));
  });

  describe("writeValue", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
    }));

    it("should do nothing when value is null", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(ONE_HOUR);
      flush();

      component.writeValue(null);
      flush();

      expect(component.form.controls.vaultTimeout.value).toBe(ONE_HOUR);
    }));

    it("should set form to custom mode when value doesn't match any available option", fakeAsync(() => {
      component.writeValue(NINETY_MINUTES);
      flush();

      expect(component.form.controls.vaultTimeout.value).toBe(VaultTimeoutStringType.Custom);
      expect(component.form.controls.custom.value).toEqual({ hours: 1, minutes: 30 });
    }));

    it.each([ONE_MINUTE, FIVE_MINUTES, FIFTEEN_MINUTES, THIRTY_MINUTES, ONE_HOUR, FOUR_HOURS])(
      "should set vaultTimeout directly when numeric value %s matches preset option",
      fakeAsync((timeout: number) => {
        component.writeValue(timeout);
        flush();

        expect(component.form.controls.vaultTimeout.value).toBe(timeout);
      }),
    );

    it.each([
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.OnLocked,
      VaultTimeoutStringType.Never,
    ])(
      "should set vaultTimeout directly when string value %s matches preset option",
      fakeAsync((timeout: VaultTimeout) => {
        component.writeValue(timeout);
        flush();

        expect(component.form.controls.vaultTimeout.value).toBe(timeout);
      }),
    );
  });

  describe("validate", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
    }));

    it("should return null when vaultTimeout is not custom", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(ONE_HOUR);
      flush();

      const result = component.validate(component.form);

      expect(result).toBeNull();
    }));

    it("should return required error when vaultTimeout is custom and hours is null", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.controls.hours.setValue(null);
      component.form.controls.custom.controls.minutes.setValue(30);
      flush();

      const result = component.validate(component.form);

      expect(result).toEqual({ required: true });
    }));

    it("should return required error when vaultTimeout is custom and minutes is null", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.controls.hours.setValue(1);
      component.form.controls.custom.controls.minutes.setValue(null);
      flush();

      const result = component.validate(component.form);

      expect(result).toEqual({ required: true });
    }));

    it("should return required error when vaultTimeout is custom and both hours and minutes are null", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.controls.hours.setValue(null);
      component.form.controls.custom.controls.minutes.setValue(null);
      flush();

      const result = component.validate(component.form);

      expect(result).toEqual({ required: true });
    }));

    it("should return minTimeoutError when total minutes is 0", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 0, minutes: 0 });
      flush();

      const result = component.validate(component.form);

      expect(result).toEqual({ minTimeoutError: true });
    }));

    it("should return maxTimeoutError when exceeds policy maximum", fakeAsync(() => {
      const policyData: MaximumSessionTimeoutPolicyData = {
        type: "custom",
        minutes: ONE_HOUR,
      };
      policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
      flush();

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 2, minutes: 0 });
      flush();

      const result = component.validate(component.form);

      expect(result).toEqual({ maxTimeoutError: true });
    }));

    it("should return null when custom values are valid and within policy limit", fakeAsync(() => {
      const policyData: MaximumSessionTimeoutPolicyData = {
        type: "custom",
        minutes: FOUR_HOURS,
      };
      policies$.next([{ id: "1", enabled: true, data: policyData } as Policy]);
      flush();

      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 2, minutes: 30 });
      flush();

      const result = component.validate(component.form);

      expect(result).toBeNull();
    }));

    it("should return null when custom values are valid and no policy exists", fakeAsync(() => {
      component.form.controls.vaultTimeout.setValue(VaultTimeoutStringType.Custom);
      component.form.controls.custom.setValue({ hours: 5, minutes: 15 });
      flush();

      const result = component.validate(component.form);

      expect(result).toBeNull();
    }));
  });
});
