import { ActivatedRouteSnapshot, ResolveFn } from "@angular/router";

import { ProductType } from "@bitwarden/common/billing/enums";
import { Translation } from "@bitwarden/components";

import { DEFAULT_TRIAL_LENGTH_DAYS } from "../../../constants";

export const freeTrialTextResolver: ResolveFn<Translation | null> = (
  route: ActivatedRouteSnapshot,
): Translation | null => {
  const { product } = route.queryParams;
  const products: ProductType[] = (product ?? "").split(",").map((p: string) => parseInt(p));

  const trialLength = route.queryParams.trialLength
    ? parseInt(route.queryParams.trialLength)
    : DEFAULT_TRIAL_LENGTH_DAYS;

  const onlyPasswordManager = products.length === 1 && products[0] === ProductType.PasswordManager;
  const onlySecretsManager = products.length === 1 && products[0] === ProductType.SecretsManager;

  switch (true) {
    case onlyPasswordManager:
      return {
        key:
          trialLength > 0
            ? "continueSettingUpFreeTrialPasswordManager"
            : "continueSettingUpPasswordManager",
      };
    case onlySecretsManager:
      return {
        key:
          trialLength > 0
            ? "continueSettingUpFreeTrialSecretsManager"
            : "continueSettingUpSecretsManager",
      };
    default:
      return {
        key: trialLength > 0 ? "continueSettingUpFreeTrial" : "continueSettingUp",
      };
  }
};
