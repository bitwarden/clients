import { DialogCloseOptions } from "@angular/cdk/dialog";
import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import {
  SessionTimeoutAction,
  SessionTimeoutType,
} from "@bitwarden/common/key-management/session-timeout";
import { VaultTimeoutAction } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { SessionTimeoutConfirmationNeverComponent } from "./session-timeout-confirmation-never.component";
import { SessionTimeoutPolicyComponent } from "./session-timeout.component";

// Mock DialogRef, so we can mock "readonly closed" property.
class MockDialogRef extends DialogRef {
  close(result: unknown | undefined, options: DialogCloseOptions | undefined): void {}

  closed: Observable<unknown | undefined> = of();
  componentInstance: unknown | null;
  disableClose: boolean | undefined;
  isDrawer: boolean = false;
}

describe("SessionTimeoutPolicyComponent", () => {
  let component: SessionTimeoutPolicyComponent;
  let fixture: ComponentFixture<SessionTimeoutPolicyComponent>;

  const mockI18nService = mock<I18nService>();
  const mockDialogService = mock<DialogService>();
  const mockDialogRef = mock<MockDialogRef>();

  beforeEach(async () => {
    jest.resetAllMocks();

    mockDialogRef.closed = of(true);
    mockDialogService.open.mockReturnValue(mockDialogRef);
    mockDialogService.openSimpleDialog.mockResolvedValue(true);

    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);

    const testBed = TestBed.configureTestingModule({
      imports: [SessionTimeoutPolicyComponent, ReactiveFormsModule],
      providers: [FormBuilder, { provide: I18nService, useValue: mockI18nService }],
    });

    // Override DialogService provided from SharedModule (which includes DialogModule)
    testBed.overrideProvider(DialogService, { useValue: mockDialogService });

    await testBed.compileComponents();

    fixture = TestBed.createComponent(SessionTimeoutPolicyComponent);
    component = fixture.componentInstance;
  });

  function assertHoursAndMinutesInputsNotVisible() {
    const hoursInput = fixture.nativeElement.querySelector('input[formControlName="hours"]');
    const minutesInput = fixture.nativeElement.querySelector('input[formControlName="minutes"]');

    expect(hoursInput).toBeFalsy();
    expect(minutesInput).toBeFalsy();
  }

  function assertHoursAndMinutesInputs(expectedHours: string, expectedMinutes: string) {
    const hoursInput = fixture.nativeElement.querySelector('input[formControlName="hours"]');
    const minutesInput = fixture.nativeElement.querySelector('input[formControlName="minutes"]');

    expect(hoursInput).toBeTruthy();
    expect(minutesInput).toBeTruthy();
    expect(hoursInput.disabled).toBe(false);
    expect(minutesInput.disabled).toBe(false);
    expect(hoursInput.value).toBe(expectedHours);
    expect(minutesInput.value).toBe(expectedMinutes);
  }

  function setPolicyResponseType(type: SessionTimeoutType) {
    component.policyResponse = new PolicyResponse({
      Data: {
        type,
        minutes: 480,
        action: null,
      },
    });
  }

  describe("initialization and data loading", () => {
    function assertTypeAndActionSelectElementsVisible() {
      // Type and action selects should always be present
      const typeSelectDebug: DebugElement = fixture.debugElement.query(
        By.css('bit-select[formControlName="type"]'),
      );
      const actionSelectDebug: DebugElement = fixture.debugElement.query(
        By.css('bit-select[formControlName="action"]'),
      );

      expect(typeSelectDebug).toBeTruthy();
      expect(actionSelectDebug).toBeTruthy();
    }

    it("should initialize with default state when policy have no value", () => {
      component.policyResponse = undefined;

      fixture.detectChanges();

      expect(component.data.controls.type.value).toBeNull();
      expect(component.data.controls.type.hasError("required")).toBe(true);
      expect(component.data.controls.hours.value).toBe(8);
      expect(component.data.controls.hours.disabled).toBe(true);
      expect(component.data.controls.minutes.value).toBe(0);
      expect(component.data.controls.minutes.disabled).toBe(true);
      expect(component.data.controls.action.value).toBeNull();

      assertTypeAndActionSelectElementsVisible();
      assertHoursAndMinutesInputsNotVisible();
    });

    // This is for backward compatibility when type field did not exist
    it("should load as custom type when type field does not exist but minutes does", () => {
      component.policyResponse = new PolicyResponse({
        Data: {
          minutes: 500,
          action: VaultTimeoutAction.Lock,
        },
      });

      fixture.detectChanges();

      expect(component.data.controls.type.value).toBe("custom");
      expect(component.data.controls.hours.value).toBe(8);
      expect(component.data.controls.hours.disabled).toBe(false);
      expect(component.data.controls.minutes.value).toBe(20);
      expect(component.data.controls.minutes.disabled).toBe(false);
      expect(component.data.controls.action.value).toBe(VaultTimeoutAction.Lock);

      assertTypeAndActionSelectElementsVisible();
      assertHoursAndMinutesInputs("8", "20");
    });

    it.each([
      ["never", null],
      ["never", VaultTimeoutAction.Lock],
      ["never", VaultTimeoutAction.LogOut],
      ["onAppRestart", null],
      ["onAppRestart", VaultTimeoutAction.Lock],
      ["onAppRestart", VaultTimeoutAction.LogOut],
      ["onSystemLock", null],
      ["onSystemLock", VaultTimeoutAction.Lock],
      ["onSystemLock", VaultTimeoutAction.LogOut],
      ["immediately", null],
      ["immediately", VaultTimeoutAction.Lock],
      ["immediately", VaultTimeoutAction.LogOut],
      ["custom", null],
      ["custom", VaultTimeoutAction.Lock],
      ["custom", VaultTimeoutAction.LogOut],
    ])("should load correctly when policy type is %s and action is %s", (type, action) => {
      component.policyResponse = new PolicyResponse({
        Data: {
          type,
          minutes: 510,
          action,
        },
      });

      fixture.detectChanges();

      expect(component.data.controls.type.value).toBe(type);
      expect(component.data.controls.action.value).toBe(action);

      assertTypeAndActionSelectElementsVisible();

      if (type === "custom") {
        expect(component.data.controls.hours.value).toBe(8);
        expect(component.data.controls.minutes.value).toBe(30);
        expect(component.data.controls.hours.disabled).toBe(false);
        expect(component.data.controls.minutes.disabled).toBe(false);

        assertHoursAndMinutesInputs("8", "30");
      } else {
        expect(component.data.controls.hours.disabled).toBe(true);
        expect(component.data.controls.minutes.disabled).toBe(true);

        assertHoursAndMinutesInputsNotVisible();
      }
    });

    it("should have all type options and update form control when value changes", fakeAsync(() => {
      expect(component.typeOptions.length).toBe(5);
      expect(component.typeOptions[0].value).toBe("immediately");
      expect(component.typeOptions[1].value).toBe("custom");
      expect(component.typeOptions[2].value).toBe("onSystemLock");
      expect(component.typeOptions[3].value).toBe("onAppRestart");
      expect(component.typeOptions[4].value).toBe("never");
    }));

    it("should have all action options and update form control when value changes", () => {
      expect(component.actionOptions.length).toBe(3);
      expect(component.actionOptions[0].value).toBeNull();
      expect(component.actionOptions[1].value).toBe(VaultTimeoutAction.Lock);
      expect(component.actionOptions[2].value).toBe(VaultTimeoutAction.LogOut);
    });
  });

  describe("form controls change detection", () => {
    it.each(["never", "onAppRestart", "onSystemLock", "immediately"])(
      "should disable hours and minutes inputs when type changes from custom to %s",
      fakeAsync((newType: SessionTimeoutType) => {
        setPolicyResponseType("custom");
        fixture.detectChanges();

        expect(component.data.controls.hours.value).toBe(8);
        expect(component.data.controls.minutes.value).toBe(0);
        expect(component.data.controls.hours.disabled).toBe(false);
        expect(component.data.controls.minutes.disabled).toBe(false);

        component.data.patchValue({ type: newType });
        tick();
        fixture.detectChanges();

        expect(component.data.controls.hours.disabled).toBe(true);
        expect(component.data.controls.minutes.disabled).toBe(true);

        assertHoursAndMinutesInputsNotVisible();
      }),
    );

    it.each(["never", "onAppRestart", "onSystemLock", "immediately"])(
      "should enable hours and minutes inputs when type changes from %s to custom",
      fakeAsync((oldType: SessionTimeoutType) => {
        setPolicyResponseType(oldType);
        fixture.detectChanges();

        expect(component.data.controls.hours.disabled).toBe(true);
        expect(component.data.controls.minutes.disabled).toBe(true);

        component.data.patchValue({ type: "custom", hours: 8, minutes: 1 });
        tick();
        fixture.detectChanges();

        expect(component.data.controls.hours.value).toBe(8);
        expect(component.data.controls.minutes.value).toBe(1);
        expect(component.data.controls.hours.disabled).toBe(false);
        expect(component.data.controls.minutes.disabled).toBe(false);

        assertHoursAndMinutesInputs("8", "1");
      }),
    );

    it.each(["custom", "onAppRestart", "immediately"])(
      "should not show confirmation dialog when changing to %s type",
      fakeAsync((newType: SessionTimeoutType) => {
        setPolicyResponseType(null);
        fixture.detectChanges();

        component.data.patchValue({ type: newType });
        tick();
        fixture.detectChanges();

        expect(mockDialogService.open).not.toHaveBeenCalled();
        expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
      }),
    );

    it("should show never confirmation dialog when changing to never type", fakeAsync(() => {
      setPolicyResponseType(null);
      fixture.detectChanges();

      component.data.patchValue({ type: "never" });
      tick();
      fixture.detectChanges();

      expect(mockDialogService.open).toHaveBeenCalledWith(
        SessionTimeoutConfirmationNeverComponent,
        {
          disableClose: true,
        },
      );
      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
    }));

    it("should show simple confirmation dialog when changing to onSystemLock type", fakeAsync(() => {
      setPolicyResponseType(null);
      fixture.detectChanges();

      component.data.patchValue({ type: "onSystemLock" });
      tick();
      fixture.detectChanges();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        type: "info",
        title: { key: "sessionTimeoutConfirmationOnSystemLockTitle" },
        content: { key: "sessionTimeoutConfirmationOnSystemLockDescription" },
        acceptButtonText: { key: "continue" },
        cancelButtonText: { key: "cancel" },
      });
      expect(mockDialogService.open).not.toHaveBeenCalled();
      expect(component.data.controls.type.value).toBe("onSystemLock");
    }));

    it("should revert to previous type when type changed to never and dialog not confirmed", fakeAsync(() => {
      mockDialogRef.closed = of(false);
      setPolicyResponseType("immediately");
      fixture.detectChanges();

      component.data.patchValue({ type: "never" });
      tick();
      fixture.detectChanges();

      expect(mockDialogService.open).toHaveBeenCalled();
      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(component.data.controls.type.value).toBe("immediately");
    }));

    it("should revert to previous type when type changed to onSystemLock and dialog not confirmed", fakeAsync(() => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);
      setPolicyResponseType("immediately");
      fixture.detectChanges();

      component.data.patchValue({ type: "onSystemLock" });
      tick();
      fixture.detectChanges();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalled();
      expect(mockDialogService.open).not.toHaveBeenCalled();
      expect(component.data.controls.type.value).toBe("immediately");
    }));

    it("should revert to last confirmed type when canceling multiple times", fakeAsync(() => {
      mockDialogRef.closed = of(false);
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      setPolicyResponseType("custom");
      fixture.detectChanges();

      // First attempt: custom -> never (cancel)
      component.data.patchValue({ type: "never" });
      tick();
      fixture.detectChanges();

      expect(component.data.controls.type.value).toBe("custom");

      // Second attempt: custom -> onSystemLock (cancel)
      component.data.patchValue({ type: "onSystemLock" });
      tick();
      fixture.detectChanges();

      // Should revert to "custom", not "never"
      expect(component.data.controls.type.value).toBe("custom");
    }));
  });

  describe("buildRequestData", () => {
    beforeEach(() => {
      setPolicyResponseType("custom");
      fixture.detectChanges();
    });

    it("should throw max allowed timeout required error when type is invalid", () => {
      component.data.patchValue({ type: null });

      expect(() => component["buildRequestData"]()).toThrow(
        "maximumAllowedTimeoutRequired-used-i18n",
      );
    });

    it.each([
      [null, null],
      [null, 0],
      [0, null],
      [0, 0],
    ])(
      "should throw invalid time error when type is custom, hours is %o and minutes is %o ",
      (hours, minutes) => {
        component.data.patchValue({
          type: "custom",
          hours: hours,
          minutes: minutes,
        });

        expect(() => component["buildRequestData"]()).toThrow(
          "sessionTimeoutPolicyInvalidTime-used-i18n",
        );
      },
    );

    it("should return correct data when type is custom with valid time", () => {
      component.data.patchValue({
        type: "custom",
        hours: 8,
        minutes: 30,
        action: VaultTimeoutAction.Lock,
      });

      const result = component["buildRequestData"]();

      expect(result).toEqual({
        type: "custom",
        minutes: 510,
        action: VaultTimeoutAction.Lock,
      });
    });

    it.each([
      ["never", null],
      ["never", VaultTimeoutAction.Lock],
      ["never", VaultTimeoutAction.LogOut],
      ["immediately", null],
      ["immediately", VaultTimeoutAction.Lock],
      ["immediately", VaultTimeoutAction.LogOut],
      ["onSystemLock", null],
      ["onSystemLock", VaultTimeoutAction.Lock],
      ["onSystemLock", VaultTimeoutAction.LogOut],
      ["onAppRestart", null],
      ["onAppRestart", VaultTimeoutAction.Lock],
      ["onAppRestart", VaultTimeoutAction.LogOut],
    ])(
      "should return default 8 hours for backward compatibility when type is %s and action is %s",
      (type, action) => {
        component.data.patchValue({
          type: type as SessionTimeoutType,
          hours: 5,
          minutes: 25,
          action: action as SessionTimeoutAction,
        });

        const result = component["buildRequestData"]();

        expect(result).toEqual({
          type,
          minutes: 480,
          action,
        });
      },
    );
  });
});
