import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { ProductTierType, ProductType } from "@bitwarden/common/billing/enums";

import { freeTrialTextResolver } from "./free-trial-text.resolver";

const route = {
  queryParams: {},
} as ActivatedRouteSnapshot;

const routerStateSnapshot = {} as RouterStateSnapshot;

describe("freeTrialTextResolver", () => {
  [
    {
      param: ProductType.PasswordManager,
      keyBase: "startYour7DayFreeTrialOfBitwardenPasswordManager",
    },
    {
      param: ProductType.SecretsManager,
      keyBase: "startYour7DayFreeTrialOfBitwardenSecretsManager",
    },
    {
      param: `${ProductType.PasswordManager},${ProductType.SecretsManager}`,
      keyBase: "startYour7DayFreeTrialOfBitwarden",
    },
  ].forEach(({ param, keyBase }) => {
    describe(`when product is ${param}`, () => {
      beforeEach(() => {
        route.queryParams.product = `${param}`;
      });

      it("returns teams trial text", () => {
        route.queryParams.productTier = ProductTierType.Teams;

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(`${keyBase}ForTeams`);
      });

      it("returns enterprise trial text", () => {
        route.queryParams.productTier = ProductTierType.Enterprise;

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(`${keyBase}ForEnterprise`);
      });

      it("returns families trial text", () => {
        route.queryParams.productTier = ProductTierType.Families;

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(`${keyBase}ForFamilies`);
      });

      it("returns default trial text", () => {
        route.queryParams.productTier = "";

        expect(freeTrialTextResolver(route, routerStateSnapshot)).toBe(keyBase);
      });
    });
  });
});
