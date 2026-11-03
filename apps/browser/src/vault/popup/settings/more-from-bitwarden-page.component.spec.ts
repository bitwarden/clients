import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { FamiliesPolicyService } from "../../../billing/services/families-policy.service";

import { MoreFromBitwardenPageComponent } from "./more-from-bitwarden-page.component";

describe("MoreFromBitwardenPageComponent", () => {
  const userId = Utils.newGuid() as UserId;
  let organizationService: MockProxy<OrganizationService>;
  let govModeService: MockProxy<GovModeService>;

  const createComponent = () =>
    new MoreFromBitwardenPageComponent(
      mock<DialogService>(),
      mock<EnvironmentService>(),
      organizationService,
      mock<FamiliesPolicyService>(),
      mockAccountServiceWith(userId),
      govModeService,
    );

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    organizationService.familySponsorshipAvailable$.mockReturnValue(of(true));
    govModeService = mock<GovModeService>();
  });

  describe("familySponsorshipAvailable$", () => {
    it("emits true when sponsorship is available outside gov mode", async () => {
      govModeService.isGovMode$.mockReturnValue(of(false));

      const result = await firstValueFrom(createComponent()["familySponsorshipAvailable$"]);

      expect(result).toBe(true);
    });

    it("emits false in gov mode", async () => {
      govModeService.isGovMode$.mockReturnValue(of(true));

      const result = await firstValueFrom(createComponent()["familySponsorshipAvailable$"]);

      expect(result).toBe(false);
    });

    it("emits false when sponsorship is unavailable", async () => {
      organizationService.familySponsorshipAvailable$.mockReturnValue(of(false));
      govModeService.isGovMode$.mockReturnValue(of(false));

      const result = await firstValueFrom(createComponent()["familySponsorshipAvailable$"]);

      expect(result).toBe(false);
    });
  });
});
