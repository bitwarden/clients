import { ActivatedRouteSnapshot, ResolveFn } from "@angular/router";

import { ProductType } from "@bitwarden/common/enums";

import { Product } from "../enums/product";

export const freeTrialTextResolver: ResolveFn<string | null> = (
  route: ActivatedRouteSnapshot,
): string | null => {
  const { product, planType } = route.queryParams;
  const products: Product[] = (product ?? "").split(",");

  const onlyPasswordManager = products.length === 1 && products[0] === Product.PasswordManager;
  const onlySecretsManager = products.length === 1 && products[0] === Product.SecretsManager;
  const forTeams = parseInt(planType) === ProductType.Teams;
  const forEnterprise = parseInt(planType) === ProductType.Enterprise;
  const forFamilies = parseInt(planType) === ProductType.Families;

  switch (true) {
    case onlyPasswordManager && forTeams:
      return "startYour7DayFreeTrialOfBitwardenPasswordManagerForTeams";
    case onlyPasswordManager && forEnterprise:
      return "startYour7DayFreeTrialOfBitwardenPasswordManagerForEnterprise";
    case onlyPasswordManager && forFamilies:
      return "startYour7DayFreeTrialOfBitwardenPasswordManagerForFamilies";
    case onlyPasswordManager:
      return "startYour7DayFreeTrialOfBitwardenPasswordManager";
    case onlySecretsManager && forTeams:
      return "startYour7DayFreeTrialOfBitwardenSecretsManagerForTeams";
    case onlySecretsManager && forEnterprise:
      return "startYour7DayFreeTrialOfBitwardenSecretsManagerForEnterprise";
    case onlySecretsManager && forFamilies:
      return "startYour7DayFreeTrialOfBitwardenSecretsManagerForFamilies";
    case onlySecretsManager:
      return "startYour7DayFreeTrialOfBitwardenSecretsManager";
    case forTeams:
      return "startYour7DayFreeTrialOfBitwardenForTeams";
    case forEnterprise:
      return "startYour7DayFreeTrialOfBitwardenForEnterprise";
    case forFamilies:
      return "startYour7DayFreeTrialOfBitwardenForFamilies";
    default:
      return "startYour7DayFreeTrialOfBitwarden";
  }
};
