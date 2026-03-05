import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, ToastService } from "@bitwarden/components";

import { DeleteAccountComponent } from "./delete-account.component";

describe("DeleteAccountComponent", () => {
  let component: DeleteAccountComponent;
  let fixture: ComponentFixture<DeleteAccountComponent>;
  let i18nService: MockProxy<I18nService>;
  let formBuilder: FormBuilder;
  let accountApiService: MockProxy<AccountApiService>;
  let toastService: MockProxy<ToastService>;
  let configService: MockProxy<ConfigService>;
  let dialogRef: MockProxy<DialogRef>;

  beforeEach(async () => {
    jest.clearAllMocks();

    i18nService = mock<I18nService>();
    formBuilder = new FormBuilder();
    accountApiService = mock<AccountApiService>();
    toastService = mock<ToastService>();
    configService = mock<ConfigService>();
    dialogRef = mock<DialogRef>();

    i18nService.t.mockImplementation((key: any) => key);

    await TestBed.configureTestingModule({
      imports: [DeleteAccountComponent],
      providers: [
        provideNoopAnimations(),
        { provide: I18nService, useValue: i18nService },
        { provide: FormBuilder, useValue: formBuilder },
        { provide: AccountApiService, useValue: accountApiService },
        { provide: ToastService, useValue: toastService },
        { provide: ConfigService, useValue: configService },
        { provide: DialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
  });

  describe("submit", () => {
    const mockVerification: VerificationWithSecret = {
      type: 0,
      secret: "masterPassword123",
    };

    describe("when feature flag is enabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(true));
        fixture = TestBed.createComponent(DeleteAccountComponent);
        component = fixture.componentInstance;
        component.deleteForm.patchValue({
          verification: mockVerification,
        });
      });

      it("should delete account and show success toast on successful deletion", async () => {
        accountApiService.deleteAccount.mockResolvedValue(undefined);

        await component.submit();

        expect(accountApiService.deleteAccount).toHaveBeenCalledWith(mockVerification);
        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: "accountDeleted",
          message: "accountDeletedDesc",
        });
        expect(component["invalidSecret"]()).toBe(false);
        expect(dialogRef.close).toHaveBeenCalled();
      });

      it("should set invalidSecret to true and show error toast when deletion fails", async () => {
        accountApiService.deleteAccount.mockRejectedValue(new Error("Invalid credentials"));

        await component.submit();

        expect(accountApiService.deleteAccount).toHaveBeenCalledWith(mockVerification);
        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: "errorOccurred",
          message: "userVerificationFailed",
        });
        expect(component["invalidSecret"]()).toBe(true);
        expect(dialogRef.close).not.toHaveBeenCalled();
      });

      it("should reset invalidSecret to false before attempting deletion", async () => {
        component["invalidSecret"].set(true);
        accountApiService.deleteAccount.mockResolvedValue(undefined);

        await component.submit();

        expect(component["invalidSecret"]()).toBe(false);
      });
    });

    describe("when feature flag is disabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(false));
        fixture = TestBed.createComponent(DeleteAccountComponent);
        component = fixture.componentInstance;
        component.deleteForm.patchValue({
          verification: mockVerification,
        });
      });

      it("should delete account and show success toast on successful deletion", async () => {
        accountApiService.deleteAccount.mockResolvedValue(undefined);

        await component.submit();

        expect(accountApiService.deleteAccount).toHaveBeenCalledWith(mockVerification);
        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: "accountDeleted",
          message: "accountDeletedDesc",
        });
        expect(dialogRef.close).not.toHaveBeenCalled();
      });

      it("should not set invalidSecret when deletion fails", async () => {
        const initialInvalidSecret = component["invalidSecret"]();
        accountApiService.deleteAccount.mockRejectedValue(new Error("Invalid credentials"));

        await expect(component.submit()).rejects.toThrow("Invalid credentials");

        expect(accountApiService.deleteAccount).toHaveBeenCalledWith(mockVerification);
        expect(toastService.showToast).not.toHaveBeenCalled();
        expect(component["invalidSecret"]()).toBe(initialInvalidSecret);
      });
    });
  });
});
