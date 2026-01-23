import { FormBuilder } from "@angular/forms";
import { MockProxy, mock } from "jest-mock-extended";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { DeleteAccountComponent } from "./delete-account.component";

describe("DeleteAccountComponent", () => {
  let component: DeleteAccountComponent;
  let i18nService: MockProxy<I18nService>;
  let formBuilder: FormBuilder;
  let accountApiService: MockProxy<AccountApiService>;
  let toastService: MockProxy<ToastService>;
  let configService: MockProxy<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    i18nService = mock<I18nService>();
    formBuilder = new FormBuilder();
    accountApiService = mock<AccountApiService>();
    toastService = mock<ToastService>();
    configService = mock<ConfigService>();

    i18nService.t.mockImplementation((key: any) => key);

    component = new DeleteAccountComponent(
      i18nService,
      formBuilder,
      accountApiService,
      toastService,
      configService,
    );
  });

  describe("submit", () => {
    const mockVerification: VerificationWithSecret = {
      type: 0,
      secret: "masterPassword123",
    };

    beforeEach(() => {
      component.deleteForm.patchValue({
        verification: mockVerification,
      });
    });

    describe("when feature flag is enabled", () => {
      beforeEach(() => {
        component["migrationMilestone4"] = true;
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
        expect(component["invalidSecret"]).toBe(false);
      });

      it("should set invalidSecret to true when deletion fails", async () => {
        accountApiService.deleteAccount.mockRejectedValue(new Error("Invalid credentials"));

        await component.submit();

        expect(accountApiService.deleteAccount).toHaveBeenCalledWith(mockVerification);
        expect(toastService.showToast).not.toHaveBeenCalled();
        expect(component["invalidSecret"]).toBe(true);
      });

      it("should reset invalidSecret to false before attempting deletion", async () => {
        component["invalidSecret"] = true;
        accountApiService.deleteAccount.mockResolvedValue(undefined);

        await component.submit();

        expect(component["invalidSecret"]).toBe(false);
      });
    });

    describe("when feature flag is disabled", () => {
      beforeEach(() => {
        component["migrationMilestone4"] = false;
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
      });

      it("should not set invalidSecret when deletion fails", async () => {
        const initialInvalidSecret = component["invalidSecret"];
        accountApiService.deleteAccount.mockRejectedValue(new Error("Invalid credentials"));

        await component.submit();

        expect(accountApiService.deleteAccount).toHaveBeenCalledWith(mockVerification);
        expect(toastService.showToast).not.toHaveBeenCalled();
        expect(component["invalidSecret"]).toBe(initialInvalidSecret);
      });
    });
  });
});
