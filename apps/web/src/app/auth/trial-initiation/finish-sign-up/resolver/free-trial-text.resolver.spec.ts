import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { ProductType } from "@bitwarden/common/enums";

import { freeTrialTextResolver } from "./free-trial-text.resolver";

const route = {
  queryParams: {},
} as ActivatedRouteSnapshot;

const routerStateSnapshot = {} as RouterStateSnapshot;

describe("freeTrialTextResolver", () => {
  [
    { param: "PasswordManager", keyBase: "startYour7DayFreeTrialOfBitwardenPasswordManager" },
    { param: "SecretsManager", keyBase: "startYour7DayFreeTrialOfBitwardenSecretsManager" },
    { param: "PasswordManager,SecretsManager", keyBase: "startYour7DayFreeTrialOfBitwarden" },
  ].forEach(({ param, keyBase }) => {
    describe(`when product is ${param}`, () => {
      beforeEach(() => {
        route.queryParams.product = param;
      });

      it("returns teams trial text", () => {
        route.queryParams.planType = ProductType.Teams;

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(`${keyBase}ForTeams`);
      });

      it("returns enterprise trial text", () => {
        route.queryParams.planType = ProductType.Enterprise;

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(`${keyBase}ForEnterprise`);
      });

      it("returns families trial text", () => {
        route.queryParams.planType = ProductType.Families;

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(`${keyBase}ForFamilies`);
      });

      it("returns default trial text", () => {
        route.queryParams.planType = "";

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(keyBase);
      });
    });
  });
});
