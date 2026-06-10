import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";
import {
  TwoFactorAuthenticationPolicy,
  TwoFactorAuthenticationPolicyComponent,
} from "./two-factor-authentication.component";

describe("TwoFactorAuthenticationPolicy", () => {
  const policy = new TwoFactorAuthenticationPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toBe("twoStepLoginPolicyTitle");
    expect(policy.description).toBe("twoStepLoginPolicyDesc");
    expect(policy.warningKey).toBe("twoStepLoginPolicyWarningV2");
    expect(policy.v2?.description).toBe("twoStepLoginPolicyDescV2");
    expect(policy.type).toBe(PolicyType.TwoFactorAuthentication);
    expect(policy.component).toBe(TwoFactorAuthenticationPolicyComponent);
  });

  describe("v2", () => {
    it("should point to SimpleTogglePolicyComponent", () => {
      expect(policy.v2?.component).toBe(SimpleTogglePolicyComponent);
    });
  });

  describe("display$", () => {
    it("should always display regardless of org or flag state", async () => {
      const result = await firstValueFrom(policy.display$({} as any, mock<ConfigService>()));
      expect(result).toBe(true);
    });
  });
});
