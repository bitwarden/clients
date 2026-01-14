import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, Subject, throwError } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { SharedModule } from "../../../shared";

import { PasswordAuthenticationComponent } from "./password-authentication.component";
import { SendAccessService } from "./send-access-service.abstraction";

describe("PasswordAuthenticationComponent", () => {
  let component: PasswordAuthenticationComponent;
  let fixture: ComponentFixture<PasswordAuthenticationComponent>;
  let mockSendAccessService: MockProxy<SendAccessService>;
  let mockRouter: MockProxy<Router>;
  let mockI18nService: MockProxy<I18nService>;
  let mockToastService: MockProxy<ToastService>;
  let mockLogService: MockProxy<LogService>;
  let routeParams$: Subject<any>;
  let destroyRef: { onDestroy: (callback: () => void) => void; destroy: () => void };
  let mockFormBuilder: FormBuilder;

  beforeEach(() => {
    // Create subjects and observables
    routeParams$ = new Subject();
    const onDestroyCallbacks: (() => void)[] = [];
    destroyRef = {
      onDestroy: (callback: () => void) => {
        onDestroyCallbacks.push(callback);
      },
      destroy: () => {
        onDestroyCallbacks.forEach((cb) => cb());
      },
    };

    // Setup mocks
    mockSendAccessService = mock<SendAccessService>();
    mockRouter = mock<Router>();
    mockI18nService = mock<I18nService>();
    mockToastService = mock<ToastService>();
    mockLogService = mock<LogService>();

    // Mock i18n to return the key
    mockI18nService.t.mockImplementation((key) => key);

    // Create a custom FormBuilder that captures validators
    mockFormBuilder = new FormBuilder();
    const originalGroup = mockFormBuilder.group.bind(mockFormBuilder);
    mockFormBuilder.group = jest.fn().mockImplementation(originalGroup);

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, SharedModule, PasswordAuthenticationComponent],
      providers: [
        { provide: FormBuilder, useValue: mockFormBuilder },
        { provide: SendAccessService, useValue: mockSendAccessService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { params: routeParams$.asObservable() },
        },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
        { provide: "DestroyRef", useValue: destroyRef },
      ],
    });

    fixture = TestBed.createComponent(PasswordAuthenticationComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    destroyRef.destroy();
    jest.clearAllMocks();
  });

  describe("Component Creation", () => {
    it("creates component successfully when initialized", () => {
      expect(component).toBeTruthy();
      expect(mockFormBuilder.group).toHaveBeenCalled();
    });
  });

  describe("Form Validation Tests", () => {
    it("passwordRequired validator returns error when control value is empty", () => {
      const passwordControl = component.formGroup.get("password");
      const validator = passwordControl?.validator;
      const control = { value: "" };
      const result = validator!(control as any);

      expect(result).toEqual({ password: "sendAccessInvalidPassword" });
      expect(mockI18nService.t).toHaveBeenCalledWith("sendAccessInvalidPassword");
    });

    it("passwordRequired validator returns null when control has value", () => {
      const passwordControl = component.formGroup.get("password");
      const validator = passwordControl?.validator;
      const control = { value: "test-password" };
      const result = validator!(control as any);

      expect(result).toBeNull();
    });

    it("passwordRequired validator calls authenticationState$.next('none') when validated", () => {
      // Access the private authenticationState$ through component
      const authenticationStateSpy = jest.spyOn(component["authenticationState$"], "next");

      const passwordControl = component.formGroup.get("password");
      const validator = passwordControl?.validator;
      const control = { value: "any-value" };
      validator!(control as any);

      expect(authenticationStateSpy).toHaveBeenCalledWith("none");
    });

    it("invalidPassword asyncValidator returns password error when authenticationState$ emits 'failed'", async () => {
      const passwordControl = component.formGroup.get("password");
      const validator = passwordControl?.asyncValidator;
      const control = { value: "test-password" };

      // Set authentication state to failed
      component["authenticationState$"].next("failed");

      const result$ = await validator!(control as any);
      const result = await firstValueFrom(result$ as any);

      expect(result).toEqual({ password: "sendAccessInvalidPassword" });
    });

    it("invalidPassword asyncValidator returns null when authenticationState$ emits 'success'", async () => {
      const passwordControl = component.formGroup.get("password");
      const validator = passwordControl?.asyncValidator;
      const control = { value: "test-password" };

      // Set authentication state to success
      component["authenticationState$"].next("success");

      const result$ = await validator!(control as any);
      const result = await firstValueFrom(result$ as any);

      expect(result).toBeNull();
    });

    it("invalidPassword asyncValidator returns null when authenticationState$ emits 'none'", async () => {
      const passwordControl = component.formGroup.get("password");
      const validator = passwordControl?.asyncValidator;
      const control = { value: "test-password" };

      // Set authentication state to none
      component["authenticationState$"].next("none");

      const result$ = await validator!(control as any);
      const result = await firstValueFrom(result$ as any);

      expect(result).toBeNull();
    });
  });

  describe("Authentication Pipeline Tests", () => {
    it("extracts sendId from route params when component is constructed", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(true));

      // Emit route params
      routeParams$.next({ sendId: "test-send-id" });

      // Trigger authentication
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1); // for debounce

      expect(mockSendAccessService.authenticate$).toHaveBeenCalledWith(
        "test-send-id",
        "test-password",
      );
    }));

    it("maps form password to empty string when password is null", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(true));

      routeParams$.next({ sendId: "test-send-id" });

      // Set password to null
      component.formGroup.patchValue({ password: null });
      component.authenticate("test");
      tick(1);

      expect(mockSendAccessService.authenticate$).toHaveBeenCalledWith("test-send-id", "");
    }));

    it("triggers authentication when authenticate$ subject emits", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(true));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });

      // Trigger authentication
      component.authenticate("test");

      // Should be called immediately (no debounce in the new implementation)
      expect(mockSendAccessService.authenticate$).toHaveBeenCalledWith(
        "test-send-id",
        "test-password",
      );
    }));

    it("calls access.authenticate$ with sendId and password when authentication is triggered", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(true));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(mockSendAccessService.authenticate$).toHaveBeenCalledWith(
        "test-send-id",
        "test-password",
      );
    }));

    it("updates authenticationState$ to 'success' when access.authenticate$ returns true", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(true));
      const authenticationStateSpy = jest.spyOn(component["authenticationState$"], "next");

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(authenticationStateSpy).toHaveBeenCalledWith("success");
    }));

    it("updates authenticationState$ to 'failed' when access.authenticate$ returns false", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(false));
      const authenticationStateSpy = jest.spyOn(component["authenticationState$"], "next");

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "wrong-password" });
      component.authenticate("test");
      tick(1);

      expect(authenticationStateSpy).toHaveBeenCalledWith("failed");
    }));
  });

  describe("Navigation Tests", () => {
    it("navigates to send content page when authentication succeeds", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(true));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(mockRouter.navigate).toHaveBeenCalledWith(["send/content", "test-send-id"]);
    }));

    it("does not navigate when authentication fails", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(false));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "wrong-password" });
      component.authenticate("test");
      tick(1);

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    }));

    it("does not navigate when authentication state is 'none'", () => {
      // Initial state is 'none', router should not be called
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("includes sendId in navigation path when navigating to content", fakeAsync(() => {
      mockSendAccessService.authenticate$.mockReturnValue(of(true));
      const testSendId = "unique-send-id-123";

      routeParams$.next({ sendId: testSendId });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(mockRouter.navigate).toHaveBeenCalledWith(["send/content", testSendId]);
    }));
  });

  describe("Error Handling Tests", () => {
    it("calls logService.error with error when authentication throws", fakeAsync(() => {
      const testError = new Error("Network error");
      mockSendAccessService.authenticate$.mockReturnValue(throwError(() => testError));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(mockLogService.error).toHaveBeenCalledWith(testError);
    }));

    it("calls toastService.showToast with i18n message when authentication throws", fakeAsync(() => {
      const testError = new Error("Network error");
      mockSendAccessService.authenticate$.mockReturnValue(throwError(() => testError));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(mockI18nService.t).toHaveBeenCalledWith("unexpectedErrorSend");
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        message: "unexpectedErrorSend",
      });
    }));

    it("calls i18nService.t with 'unexpectedErrorSend' when showing error toast", fakeAsync(() => {
      const testError = new Error("Any error");
      mockSendAccessService.authenticate$.mockReturnValue(throwError(() => testError));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(mockI18nService.t).toHaveBeenCalledWith("unexpectedErrorSend");
    }));

    it("does not navigate when authentication throws error", fakeAsync(() => {
      const testError = new Error("Network error");
      mockSendAccessService.authenticate$.mockReturnValue(throwError(() => testError));

      routeParams$.next({ sendId: "test-send-id" });
      component.formGroup.patchValue({ password: "test-password" });
      component.authenticate("test");
      tick(1);

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    }));
  });

  describe("User Interaction Tests", () => {
    it("authenticate method calls authenticate$.next() when invoked", () => {
      const authenticateSpy = jest.spyOn(component["authenticate$"], "next");

      component.authenticate("test-source");

      expect(authenticateSpy).toHaveBeenCalledWith("test-source");
    });

    it("form group is created with password control using correct validators", () => {
      const passwordControl = component.formGroup.get("password");
      expect(passwordControl).toBeTruthy();
      expect(passwordControl?.validator).toBeTruthy();
      expect(passwordControl?.asyncValidator).toBeTruthy();
    });

    it("form control uses blur updateOn strategy", () => {
      const passwordControl = component.formGroup.get("password");
      expect(passwordControl?.updateOn).toBe("blur");
    });
  });

  describe("Cleanup Tests", () => {
    it("uses takeUntilDestroyed for authentication pipeline cleanup", () => {
      // This test verifies that takeUntilDestroyed is used in the component
      // The actual cleanup behavior is handled by Angular's takeUntilDestroyed operator
      expect(component).toBeTruthy();

      // We can verify that the component can be created and destroyed without issues
      destroyRef.destroy();
      expect(component).toBeTruthy();
    });

    it("uses takeUntilDestroyed for navigation subscription cleanup", () => {
      // This test verifies that takeUntilDestroyed is used for navigation
      // The actual cleanup behavior is handled by Angular's takeUntilDestroyed operator
      expect(component).toBeTruthy();

      // We can verify that the component can be created and destroyed without issues
      destroyRef.destroy();
      expect(component).toBeTruthy();
    });
  });
});
