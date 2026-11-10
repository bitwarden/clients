import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import {
  ManageItemTypesPolicy,
  RestrictedItemTypesPolicy,
} from "./restricted-item-types.component";

describe("restricted item types policy definitions", () => {
  const organization = mock<Organization>();

  function configWithFlag(enabled: boolean): ConfigService {
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation(
      (flag) => of(flag === FeatureFlag.PM32009NewItemTypes ? enabled : false) as any,
    );
    return configService;
  }

  it("shows only the legacy policy when the new item types flag is off", async () => {
    const configService = configWithFlag(false);

    expect(
      await firstValueFrom(new RestrictedItemTypesPolicy().display$(organization, configService)),
    ).toBe(true);
    expect(
      await firstValueFrom(new ManageItemTypesPolicy().display$(organization, configService)),
    ).toBe(false);
  });

  it("shows only the manage item types policy when the new item types flag is on", async () => {
    const configService = configWithFlag(true);

    expect(
      await firstValueFrom(new RestrictedItemTypesPolicy().display$(organization, configService)),
    ).toBe(false);
    expect(
      await firstValueFrom(new ManageItemTypesPolicy().display$(organization, configService)),
    ).toBe(true);
  });

  it("edits the same policy type", () => {
    expect(new ManageItemTypesPolicy().type).toBe(new RestrictedItemTypesPolicy().type);
  });
});
