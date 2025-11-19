import { ComponentFixture, fakeAsync, flush, TestBed, waitForAsync } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, filter, firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  MaximumVaultTimeoutPolicyData,
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutOption,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { SessionTimeoutInputComponent } from "../components/session-timeout-input.component";
import { SessionTimeoutSettingsComponentService } from "../services/session-timeout-settings-component.service";

import { SessionTimeoutSettingsComponent } from "./session-timeout-settings.component";

describe("SessionTimeoutSettingsComponent", () => {
  let component: SessionTimeoutSettingsComponent;
  let fixture: ComponentFixture<SessionTimeoutSettingsComponent>;

  // Mock services
  let mockVaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let mockSessionTimeoutSettingsComponentService: MockProxy<SessionTimeoutSettingsComponentService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockToastService: MockProxy<ToastService>;
  let mockPolicyService: MockProxy<PolicyService>;
  let accountService: FakeAccountService;
  let mockDialogService: MockProxy<DialogService>;
  let mockLogService: MockProxy<LogService>;

  const mockUserId = "user-id" as UserId;
  const mockEmail = "test@example.com";
  const mockInitialTimeout = 5;
  const mockInitialTimeoutAction = VaultTimeoutAction.Lock;
  let refreshTimeoutActionSettings$: BehaviorSubject<void>;
  let availableTimeoutOptions$: BehaviorSubject<VaultTimeoutOption[]>;

  beforeEach(async () => {
    refreshTimeoutActionSettings$ = new BehaviorSubject<void>(undefined);
    availableTimeoutOptions$ = new BehaviorSubject<VaultTimeoutOption[]>([
      { name: "oneMinute-used-i18n", value: 1 },
      { name: "fiveMinutes-used-i18n", value: 5 },
      { name: "onRestart-used-i18n", value: VaultTimeoutStringType.OnRestart },
      { name: "onLocked-used-i18n", value: VaultTimeoutStringType.OnLocked },
      { name: "onSleep-used-i18n", value: VaultTimeoutStringType.OnSleep },
      { name: "onIdle-used-i18n", value: VaultTimeoutStringType.OnIdle },
      { name: "never-used-i18n", value: VaultTimeoutStringType.Never },
    ]);

    mockVaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    mockSessionTimeoutSettingsComponentService = mock<SessionTimeoutSettingsComponentService>();
    mockI18nService = mock<I18nService>();
    mockToastService = mock<ToastService>();
    mockPolicyService = mock<PolicyService>();
    accountService = mockAccountServiceWith(mockUserId, { email: mockEmail });
    mockDialogService = mock<DialogService>();
    mockLogService = mock<LogService>();

    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);

    mockVaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockImplementation(() =>
      of(mockInitialTimeout),
    );
    mockVaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockImplementation(() =>
      of(mockInitialTimeoutAction),
    );
    mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
      of([VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut]),
    );
    mockSessionTimeoutSettingsComponentService.availableTimeoutOptions$ =
      availableTimeoutOptions$.asObservable();
    mockPolicyService.policiesByType$.mockImplementation(() => of([]));

    await TestBed.configureTestingModule({
      imports: [
        SessionTimeoutSettingsComponent,
        ReactiveFormsModule,
        SessionTimeoutInputComponent,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: VaultTimeoutSettingsService, useValue: mockVaultTimeoutSettingsService },
        {
          provide: SessionTimeoutSettingsComponentService,
          useValue: mockSessionTimeoutSettingsComponentService,
        },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: AccountService, useValue: accountService },
        { provide: LogService, useValue: mockLogService },
        { provide: DialogService, useValue: mockDialogService },
      ],
    })
      .overrideComponent(SessionTimeoutSettingsComponent, {
        set: {
          providers: [{ provide: DialogService, useValue: mockDialogService }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SessionTimeoutSettingsComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput("refreshTimeoutActionSettings", refreshTimeoutActionSettings$);
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("canLock", () => {
    it("should return true when Lock action is available", fakeAsync(() => {
      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of([VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut]),
      );

      fixture.detectChanges();
      flush();

      expect(component.canLock).toBe(true);
    }));

    it("should return false when Lock action is not available", fakeAsync(() => {
      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of([VaultTimeoutAction.LogOut]),
      );

      fixture.detectChanges();
      flush();

      expect(component.canLock).toBe(false);
    }));
  });

  describe("ngOnInit", () => {
    it("should initialize available timeout options", fakeAsync(async () => {
      fixture.detectChanges();
      flush();

      const options = await firstValueFrom(
        component["availableTimeoutOptions$"].pipe(filter((options) => options.length > 0)),
      );

      expect(options).toContainEqual({ name: "oneMinute-used-i18n", value: 1 });
      expect(options).toContainEqual({ name: "fiveMinutes-used-i18n", value: 5 });
      expect(options).toContainEqual({
        name: "onIdle-used-i18n",
        value: VaultTimeoutStringType.OnIdle,
      });
      expect(options).toContainEqual({
        name: "onSleep-used-i18n",
        value: VaultTimeoutStringType.OnSleep,
      });
      expect(options).toContainEqual({
        name: "onLocked-used-i18n",
        value: VaultTimeoutStringType.OnLocked,
      });
      expect(options).toContainEqual({
        name: "onRestart-used-i18n",
        value: VaultTimeoutStringType.OnRestart,
      });
      expect(options).toContainEqual({
        name: "never-used-i18n",
        value: VaultTimeoutStringType.Never,
      });
    }));

    it("should initialize available timeout actions", fakeAsync(() => {
      const expectedActions = [VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut];

      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of(expectedActions),
      );

      fixture.detectChanges();
      flush();

      expect(component["availableTimeoutActions"]()).toEqual(expectedActions);
    }));

    it("should initialize timeout and action", fakeAsync(() => {
      const expectedTimeout = 15;
      const expectedAction = VaultTimeoutAction.Lock;

      mockVaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockImplementation(() =>
        of(expectedTimeout),
      );
      mockVaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockImplementation(() =>
        of(expectedAction),
      );

      fixture.detectChanges();
      flush();

      expect(component.formGroup.value.timeout).toBe(expectedTimeout);
      expect(component.formGroup.value.timeoutAction).toBe(expectedAction);
    }));

    it("should fall back to OnRestart when current option is not available", fakeAsync(() => {
      availableTimeoutOptions$.next([
        { name: "oneMinute-used-i18n", value: 1 },
        { name: "fiveMinutes-used-i18n", value: 5 },
        { name: "onRestart-used-i18n", value: VaultTimeoutStringType.OnRestart },
      ]);

      const unavailableTimeout = VaultTimeoutStringType.Never;

      mockVaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockImplementation(() =>
        of(unavailableTimeout),
      );

      fixture.detectChanges();
      flush();

      expect(component.formGroup.value.timeout).toBe(VaultTimeoutStringType.OnRestart);
    }));

    it("should disable timeout action control when policy enforces action", fakeAsync(() => {
      const policyData: MaximumVaultTimeoutPolicyData = {
        minutes: 15,
        action: VaultTimeoutAction.LogOut,
      };
      mockPolicyService.policiesByType$.mockImplementation(() =>
        of([{ id: "1", data: policyData }] as Policy[]),
      );

      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of([VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut]),
      );

      fixture.detectChanges();
      flush();

      expect(component.formGroup.controls.timeoutAction.disabled).toBe(true);
    }));

    it("should disable timeout action control when only one action is available", fakeAsync(() => {
      mockPolicyService.policiesByType$.mockImplementation(() => of([]));

      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of([VaultTimeoutAction.Lock]),
      );

      fixture.detectChanges();
      flush();

      expect(component.formGroup.controls.timeoutAction.disabled).toBe(true);
    }));

    it("should disable timeout action control when policy enforces action and refreshed", fakeAsync(() => {
      const policies$ = new BehaviorSubject<Policy[]>([]);
      mockPolicyService.policiesByType$.mockReturnValue(policies$);

      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of([VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut]),
      );

      fixture.detectChanges();
      flush();

      expect(component.formGroup.controls.timeoutAction.enabled).toBe(true);

      const policyData: MaximumVaultTimeoutPolicyData = {
        minutes: 15,
        action: VaultTimeoutAction.LogOut,
      };
      policies$.next([{ id: "1", data: policyData }] as Policy[]);

      refreshTimeoutActionSettings$.next(undefined);
      flush();

      expect(component.formGroup.controls.timeoutAction.disabled).toBe(true);
    }));

    it("should disable timeout action control when only one action is available and refreshed", fakeAsync(() => {
      mockPolicyService.policiesByType$.mockImplementation(() => of([]));

      const availableActions$ = new BehaviorSubject<VaultTimeoutAction[]>([
        VaultTimeoutAction.Lock,
        VaultTimeoutAction.LogOut,
      ]);
      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockReturnValue(
        availableActions$,
      );

      fixture.detectChanges();
      flush();

      expect(component.formGroup.controls.timeoutAction.enabled).toBe(true);

      availableActions$.next([VaultTimeoutAction.Lock]);

      refreshTimeoutActionSettings$.next(undefined);
      flush();

      expect(component.formGroup.controls.timeoutAction.disabled).toBe(true);
    }));

    it("should enable timeout action control when multiple actions available and no policy and refreshed", fakeAsync(() => {
      mockPolicyService.policiesByType$.mockImplementation(() => of([]));

      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of([VaultTimeoutAction.Lock]),
      );

      fixture.detectChanges();
      flush();

      expect(component.formGroup.controls.timeoutAction.disabled).toBe(true);

      mockVaultTimeoutSettingsService.availableVaultTimeoutActions$.mockImplementation(() =>
        of([VaultTimeoutAction.Lock, VaultTimeoutAction.LogOut]),
      );

      refreshTimeoutActionSettings$.next(undefined);
      flush();

      expect(component.formGroup.controls.timeoutAction.enabled).toBe(true);
    }));

    it("should subscribe to timeout value changes", fakeAsync(() => {
      const saveSpy = jest.spyOn(component, "saveTimeout").mockResolvedValue(undefined);

      fixture.detectChanges();
      flush();

      const newTimeout = 30;
      component.formGroup.controls.timeout.setValue(newTimeout);
      flush();

      expect(saveSpy).toHaveBeenCalledWith(mockInitialTimeout, newTimeout);
    }));

    it("should subscribe to timeout action value changes", fakeAsync(() => {
      const saveSpy = jest.spyOn(component, "saveTimeoutAction").mockResolvedValue(undefined);

      fixture.detectChanges();
      flush();

      component.formGroup.controls.timeoutAction.setValue(VaultTimeoutAction.LogOut);
      flush();

      expect(saveSpy).toHaveBeenCalledWith(VaultTimeoutAction.LogOut);
    }));
  });

  describe("saveTimeout", () => {
    it("should not save when form control timeout is invalid", fakeAsync(async () => {
      fixture.detectChanges();
      flush();

      component.formGroup.controls.timeout.setValue(null);

      await component.saveTimeout(mockInitialTimeout, 30);
      flush();

      expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).not.toHaveBeenCalled();
    }));

    it("should set new value and show confirmation dialog when setting timeout to Never and dialog confirmed", waitForAsync(async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      fixture.detectChanges();
      await fixture.whenStable();

      const previousTimeout = component.formGroup.controls.timeout.value!;
      const newTimeout = VaultTimeoutStringType.Never;

      await component.saveTimeout(previousTimeout, newTimeout);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: "warning",
      });
      expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).toHaveBeenCalledWith(
        mockUserId,
        newTimeout,
        mockInitialTimeoutAction,
      );
      expect(mockSessionTimeoutSettingsComponentService.onTimeoutSave).toHaveBeenCalledWith(
        newTimeout,
      );
    }));

    it("should revert to previous value when Never confirmation is declined", waitForAsync(async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      const previousTimeout = component.formGroup.controls.timeout.value!;
      const newTimeout = VaultTimeoutStringType.Never;

      await component.saveTimeout(previousTimeout, newTimeout);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: "warning",
      });
      expect(component.formGroup.controls.timeout.value).toBe(previousTimeout);
      expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).not.toHaveBeenCalled();
      expect(mockSessionTimeoutSettingsComponentService.onTimeoutSave).not.toHaveBeenCalled();
    }));

    it.each([
      30,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.OnLocked,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutStringType.OnIdle,
    ])(
      "should set new value when setting timeout to %s",
      fakeAsync(async (timeout: VaultTimeout) => {
        fixture.detectChanges();
        flush();

        const previousTimeout = component.formGroup.controls.timeout.value!;
        await component.saveTimeout(previousTimeout, timeout);
        flush();

        expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).toHaveBeenCalledWith(
          mockUserId,
          timeout,
          mockInitialTimeoutAction,
        );
        expect(mockSessionTimeoutSettingsComponentService.onTimeoutSave).toHaveBeenCalledWith(
          timeout,
        );
      }),
    );
  });

  describe("saveTimeoutAction", () => {
    it("should set new value and show confirmation dialog when setting action to LogOut and dialog confirmed", waitForAsync(async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.saveTimeoutAction(VaultTimeoutAction.LogOut);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "vaultTimeoutLogOutConfirmationTitle" },
        content: { key: "vaultTimeoutLogOutConfirmation" },
        type: "warning",
      });
      expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).toHaveBeenCalledWith(
        mockUserId,
        mockInitialTimeout,
        VaultTimeoutAction.LogOut,
      );
    }));

    it("should revert to Lock when LogOut confirmation is declined", waitForAsync(async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.saveTimeoutAction(VaultTimeoutAction.LogOut);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "vaultTimeoutLogOutConfirmationTitle" },
        content: { key: "vaultTimeoutLogOutConfirmation" },
        type: "warning",
      });
      expect(component.formGroup.controls.timeoutAction.value).toBe(VaultTimeoutAction.Lock);
      expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).not.toHaveBeenCalled();
    }));

    it("should set timeout action to Lock value when setting timeout action to Lock", fakeAsync(async () => {
      fixture.detectChanges();
      flush();

      component.formGroup.controls.timeoutAction.setValue(VaultTimeoutAction.LogOut, {
        emitEvent: false,
      });

      await component.saveTimeoutAction(VaultTimeoutAction.Lock);
      flush();

      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).toHaveBeenCalledWith(
        mockUserId,
        mockInitialTimeout,
        VaultTimeoutAction.Lock,
      );
    }));

    it("should not save and show error toast when timeout has policy error", fakeAsync(async () => {
      fixture.detectChanges();
      flush();

      component.formGroup.controls.timeout.setErrors({ policyError: true });

      await component.saveTimeoutAction(VaultTimeoutAction.Lock);
      flush();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "vaultTimeoutTooLarge-used-i18n",
      });
      expect(mockVaultTimeoutSettingsService.setVaultTimeoutOptions).not.toHaveBeenCalled();
    }));
  });
});
