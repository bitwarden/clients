import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import {
  DesktopAutotypeGaPolicy,
  DesktopAutotypeGaPolicyComponent,
} from "./autotype-ga-policy.component";

jest.mock("@bitwarden/common/desktop-native/services/autotype-feature-flags", () => ({
  autotypeFeatureFlagState$: jest.fn(),
}));

describe("DesktopAutotypeGaPolicy", () => {
  const policy = new DesktopAutotypeGaPolicy();
  const org = {} as Organization;

  it("should have correct attributes", () => {
    expect(policy.name).toBe("desktopAppAutofillPolicyTitle");
    expect(policy.description).toBe("desktopAppAutofillPolicyDesc");
    expect(policy.type).toBe(PolicyType.AutotypeGaPolicy);
    expect(policy.component).toBe(DesktopAutotypeGaPolicyComponent);
    expect(policy.showDescription).toBe(false);
  });

  describe("display$", () => {
    let configService: MockProxy<ConfigService>;

    beforeEach(() => {
      configService = mock<ConfigService>();
      jest.mocked(autotypeFeatureFlagState$).mockReset();
    });

    it("displays when the resolved feature flag state is Ga", async () => {
      jest.mocked(autotypeFeatureFlagState$).mockReturnValue(of(AutotypeFeatureFlagState.Ga));

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(autotypeFeatureFlagState$).toHaveBeenCalledWith(configService);
      expect(result).toBe(true);
    });

    it("does not display when the resolved feature flag state is Mvp", async () => {
      jest.mocked(autotypeFeatureFlagState$).mockReturnValue(of(AutotypeFeatureFlagState.Mvp));

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(result).toBe(false);
    });

    it("does not display when the resolved feature flag state is Off", async () => {
      jest.mocked(autotypeFeatureFlagState$).mockReturnValue(of(AutotypeFeatureFlagState.Off));

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(result).toBe(false);
    });
  });
});
