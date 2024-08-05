import { ActivatedRouteSnapshot, ResolveFn } from "@angular/router";

import { ProductType, ProductTierType } from "@bitwarden/common/billing/enums";

export const freeTrialTextResolver: ResolveFn<string | null> = (
  route: ActivatedRouteSnapshot,
): string | null => {
  const { product, productTier } = route.queryParams;
  const products: ProductType[] = (product ?? "").split(",").map((p: string) => parseInt(p));

  const onlyPasswordManager = products.length === 1 && products[0] === ProductType.PasswordManager;
  const onlySecretsManager = products.length === 1 && products[0] === ProductType.SecretsManager;
  const forTeams = parseInt(productTier) === ProductTierType.Teams;
  const forEnterprise = parseInt(productTier) === ProductTierType.Enterprise;
  const forFamilies = parseInt(productTier) === ProductTierType.Families;

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
