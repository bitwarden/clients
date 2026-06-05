import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { RequireSsoPolicy, RequireSsoPolicyComponent } from "./require-sso.component";
import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

describe("RequireSsoPolicy", () => {
  const policy = new RequireSsoPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toBe("requireSso");
    expect(policy.description).toBe("requireSsoPolicyDesc");
    expect(policy.descriptionV2).toBe("requireSsoPolicyDescV2");
    expect(policy.prerequisiteKey).toBe("requireSsoPolicyReqV2");
    expect(policy.type).toBe(PolicyType.RequireSso);
    expect(policy.component).toBe(RequireSsoPolicyComponent);
  });

  describe("flaggedComponent", () => {
    it("should point to SimpleTogglePolicyComponent", () => {
      expect(policy.flaggedComponent?.component).toBe(SimpleTogglePolicyComponent);
    });

    it("should be gated behind the PolicyDrawers feature flag", () => {
      expect(policy.flaggedComponent?.flag).toBe(FeatureFlag.PolicyDrawers);
    });
  });

  describe("display$", () => {
    it("should display for organizations with SSO entitlement", async () => {
      const org = { useSso: true } as Organization;

      const result = await firstValueFrom(policy.display$(org, mock<ConfigService>()));

      expect(result).toBe(true);
    });

    it("should not display for organizations without SSO entitlement", async () => {
      const org = { useSso: false } as Organization;

      const result = await firstValueFrom(policy.display$(org, mock<ConfigService>()));

      expect(result).toBe(false);
    });
  });
});
