import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import {
  DesktopAutotypeDefaultSettingPolicy,
  DesktopAutotypeDefaultSettingPolicyComponent,
} from "./autotype-policy.component";
import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

describe("DesktopAutotypeDefaultSettingPolicy", () => {
  const policy = new DesktopAutotypeDefaultSettingPolicy();
  const org = {} as Organization;

  it("should have correct attributes", () => {
    expect(policy.name).toBe("desktopAutotypePolicy");
    expect(policy.description).toBe("desktopAutotypePolicyDesc");
    expect(policy.type).toBe(PolicyType.AutotypeDefaultSetting);
    expect(policy.component).toBe(DesktopAutotypeDefaultSettingPolicyComponent);
  });

  describe("v2", () => {
    it("should point to SimpleTogglePolicyComponent", () => {
      expect(policy.v2?.component).toBe(SimpleTogglePolicyComponent);
    });
  });

  describe("display$", () => {
    let configService: MockProxy<ConfigService>;

    beforeEach(() => {
      configService = mock<ConfigService>();
    });

    it("displays when only the MVP flag is enabled", async () => {
      configService.getFeatureFlag$.mockImplementation(
        (flag) => of(flag === FeatureFlag.WindowsDesktopAutotype) as any,
      );

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(result).toBe(true);
    });

    it("displays when only the GA flag is enabled", async () => {
      configService.getFeatureFlag$.mockImplementation(
        (flag) => of(flag === FeatureFlag.WindowsDesktopAutotypeGA) as any,
      );

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(result).toBe(true);
    });

    it("does not display when neither flag is enabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false) as any);

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(result).toBe(false);
    });
  });
});
