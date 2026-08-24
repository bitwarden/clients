import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { RequestSMAccessComponent } from "./request-sm-access.component";
import { SmLandingApiService } from "./sm-landing-api.service";

const USER_ID = "user-id" as UserId;

describe("RequestSMAccessComponent", () => {
  let router: MockProxy<Router>;
  let organizationService: MockProxy<OrganizationService>;
  let govModeService: MockProxy<GovModeService>;
  let logService: MockProxy<LogService>;
  let component: RequestSMAccessComponent;

  beforeEach(() => {
    router = mock<Router>();

    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));

    govModeService = mock<GovModeService>();
    govModeService.isGovMode$.mockReturnValue(of(false));

    logService = mock<LogService>();

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    component = new RequestSMAccessComponent(
      router,
      i18nService,
      organizationService,
      mock<SmLandingApiService>(),
      mock<ToastService>(),
      mockAccountServiceWith(USER_ID) as unknown as AccountService,
      govModeService,
      logService,
    );
  });

  describe("when the user belongs to no enabled organizations", () => {
    it("navigates to organization creation when not in Gov mode", async () => {
      await component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(["/create-organization"]);
    });

    it("navigates to the Secrets Manager landing page when in Gov mode", async () => {
      govModeService.isGovMode$.mockReturnValue(of(true));

      await component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(["/sm-landing"]);
      expect(router.navigate).not.toHaveBeenCalledWith(["/create-organization"]);
    });

    it("fails open and navigates to organization creation when the Gov mode check errors", async () => {
      govModeService.isGovMode$.mockReturnValue(throwError(() => new Error("boom")));

      await component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(["/create-organization"]);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("when the user belongs to an enabled organization", () => {
    it("does not navigate away in Gov mode", async () => {
      govModeService.isGovMode$.mockReturnValue(of(true));
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-id", name: "Org", enabled: true } as Organization]),
      );

      await component.ngOnInit();

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("does not navigate away when not in Gov mode", async () => {
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-id", name: "Org", enabled: true } as Organization]),
      );

      await component.ngOnInit();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
