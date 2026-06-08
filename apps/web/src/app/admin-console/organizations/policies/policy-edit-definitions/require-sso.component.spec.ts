import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { RequireSsoPolicy, RequireSsoPolicyComponent } from "./require-sso.component";
import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

describe("RequireSsoPolicy", () => {
  const policy = new RequireSsoPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toBe("requireSso");
    expect(policy.description).toBe("requireSsoPolicyDesc");
    expect(policy.v2?.description).toBe("requireSsoPolicyDescV2");
    expect(policy.v2?.prerequisiteKey).toBe("requireSsoPolicyReqV2");
    expect(policy.type).toBe(PolicyType.RequireSso);
    expect(policy.component).toBe(RequireSsoPolicyComponent);
  });

  describe("v2", () => {
    it("should point to SimpleTogglePolicyComponent", () => {
      expect(policy.v2?.component).toBe(SimpleTogglePolicyComponent);
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
