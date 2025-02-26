import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { ProductType } from "@bitwarden/common/billing/enums";

import { freeTrialTextResolver } from "./free-trial-text.resolver";

const route = {
  queryParams: {},
} as ActivatedRouteSnapshot;

const routerStateSnapshot = {} as RouterStateSnapshot;

describe("freeTrialTextResolver", () => {
  it("shows password manager text", () => {
    route.queryParams.product = `${ProductType.PasswordManager}`;

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpFreeTrialPasswordManager",
    });
  });

  it("shows secret manager text", () => {
    route.queryParams.product = `${ProductType.SecretsManager}`;

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpFreeTrialSecretsManager",
    });
  });

  it("shows default text", () => {
    route.queryParams.product = `${ProductType.PasswordManager},${ProductType.SecretsManager}`;

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpFreeTrial",
    });
  });
});
