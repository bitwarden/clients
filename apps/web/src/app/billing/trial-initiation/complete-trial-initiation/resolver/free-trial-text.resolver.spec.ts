import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { ProductType } from "@bitwarden/common/billing/enums";

import { freeTrialTextResolver } from "./free-trial-text.resolver";

const route = {
  queryParams: {},
} as ActivatedRouteSnapshot;

const routerStateSnapshot = {} as RouterStateSnapshot;

describe("freeTrialTextResolver", () => {
  beforeEach(() => {
    route.queryParams = {};
  });

  it("shows password manager free trial text", () => {
    route.queryParams.product = `${ProductType.PasswordManager}`;

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpFreeTrialPasswordManager",
    });
  });

  it("shows password manager text", () => {
    route.queryParams.product = `${ProductType.PasswordManager}`;
    route.queryParams.trialLength = "0";

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpPasswordManager",
    });
  });

  it("shows secret manager free trial text", () => {
    route.queryParams.product = `${ProductType.SecretsManager}`;

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpFreeTrialSecretsManager",
    });
  });

  it("shows secret manager text", () => {
    route.queryParams.product = `${ProductType.SecretsManager}`;
    route.queryParams.trialLength = "0";

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpSecretsManager",
    });
  });

  it("shows default free trial text", () => {
    route.queryParams.product = `${ProductType.PasswordManager},${ProductType.SecretsManager}`;

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUpFreeTrial",
    });
  });

  it("shows default text", () => {
    route.queryParams.product = `${ProductType.PasswordManager},${ProductType.SecretsManager}`;
    route.queryParams.trialLength = "0";

    expect(freeTrialTextResolver(route, routerStateSnapshot)).toEqual({
      key: "continueSettingUp",
    });
  });
});
