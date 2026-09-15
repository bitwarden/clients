import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { SMLandingComponent } from "./sm-landing.component";

const USER_ID = "user-id" as UserId;

describe("SMLandingComponent", () => {
  let organizationService: MockProxy<OrganizationService>;
  let govModeService: MockProxy<GovModeService>;
  let component: SMLandingComponent;

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));

    govModeService = mock<GovModeService>();
    govModeService.isGovMode$.mockReturnValue(of(false));

    component = new SMLandingComponent(
      organizationService,
      mockAccountServiceWith(USER_ID) as unknown as AccountService,
      govModeService,
    );
  });

  describe("when the user belongs to no enabled organizations", () => {
    it("offers organization creation when not in Gov mode", async () => {
      await component.ngOnInit();

      expect(component.showTryItNow).toBe(true);
      expect(component.tryItNowUrl).toBe("/create-organization");
    });

    it("hides the call to action when in Gov mode", async () => {
      govModeService.isGovMode$.mockReturnValue(of(true));

      await component.ngOnInit();

      expect(component.showTryItNow).toBe(false);
      expect(component.tryItNowUrl).toBeUndefined();
    });
  });

  describe("when the user belongs to an enabled organization", () => {
    it("keeps the existing call to action in Gov mode", async () => {
      govModeService.isGovMode$.mockReturnValue(of(true));
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-id", enabled: true, isOwner: false, isAdmin: false } as Organization]),
      );

      await component.ngOnInit();

      expect(component.showTryItNow).toBe(true);
      expect(component.tryItNowUrl).toBe("/request-sm-access");
    });
  });
});
