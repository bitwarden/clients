import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { RequestSMAccessComponent } from "./request-sm-access.component";
import { SmLandingApiService } from "./sm-landing-api.service";

describe("RequestSMAccessComponent", () => {
  const defaultEmailContent = "Hi, I am requesting access to Secrets Manager.";
  let component: RequestSMAccessComponent;

  beforeEach(() => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) =>
      key === "requestAccessSMDefaultEmailContent" ? defaultEmailContent : key,
    );

    component = new RequestSMAccessComponent(
      mock<Router>(),
      i18nService,
      mock<OrganizationService>(),
      mock<SmLandingApiService>(),
      mock<ToastService>(),
      mock<AccountService>(),
    );
  });

  describe("requestAccessEmailContents", () => {
    const control = () => component.requestAccessForm.controls.requestAccessEmailContents;

    it("starts with the default email content", () => {
      expect(control().value).toBe(defaultEmailContent);
      expect(control().valid).toBe(true);
    });

    it("is required", () => {
      control().setValue("");

      expect(control().hasError("required")).toBe(true);
    });

    it("accepts a note of exactly 1000 characters", () => {
      control().setValue("a".repeat(1000));

      expect(control().valid).toBe(true);
    });

    it("rejects a note longer than 1000 characters", () => {
      control().setValue("a".repeat(1001));

      expect(control().hasError("maxlength")).toBe(true);
    });
  });
});
