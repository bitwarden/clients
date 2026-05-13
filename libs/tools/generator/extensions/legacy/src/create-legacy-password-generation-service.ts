// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { engine, services, strategies } from "@bitwarden/generator-core";
import { LocalGeneratorHistoryService } from "@bitwarden/generator-history";
import { DefaultGeneratorNavigationService } from "@bitwarden/generator-navigation";

import { LegacyPasswordGenerationService } from "./legacy-password-generation.service";
import { PasswordGenerationServiceAbstraction } from "./password-generation.service.abstraction";

const { PassphraseGeneratorStrategy, PasswordGeneratorStrategy } = strategies;
const { PureCryptoRandomizer, PasswordRandomizer } = engine;

const DefaultGeneratorService = services.DefaultGeneratorService;

export function legacyPasswordGenerationServiceFactory(
  policyService: PolicyService,
  accountService: AccountService,
  stateProvider: StateProvider,
  sdkService: SdkService,
): PasswordGenerationServiceAbstraction {
  const randomizer = new PureCryptoRandomizer();
  const passwordRandomizer = new PasswordRandomizer(randomizer, Date.now);

  const passwords = new DefaultGeneratorService(
    new PasswordGeneratorStrategy(passwordRandomizer, stateProvider),
    policyService,
  );

  const passphrases = new DefaultGeneratorService(
    new PassphraseGeneratorStrategy(passwordRandomizer, stateProvider),
    policyService,
  );

  const navigation = new DefaultGeneratorNavigationService(stateProvider, policyService);

  const history = new LocalGeneratorHistoryService(stateProvider, sdkService);

  return new LegacyPasswordGenerationService(
    accountService,
    navigation,
    passwords,
    passphrases,
    history,
  );
}
