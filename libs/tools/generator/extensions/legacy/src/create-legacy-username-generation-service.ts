// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { engine, services, strategies, Integrations } from "@bitwarden/generator-core";
import { DefaultGeneratorNavigationService } from "@bitwarden/generator-navigation";
import { KeyService } from "@bitwarden/key-management";

import { LegacyUsernameGenerationService } from "./legacy-username-generation.service";
import { UsernameGenerationServiceAbstraction } from "./username-generation.service.abstraction";

const { KeyServiceRandomizer, UsernameRandomizer, EmailRandomizer, EmailCalculator } = engine;
const DefaultGeneratorService = services.DefaultGeneratorService;
const {
  CatchallGeneratorStrategy,
  SubaddressGeneratorStrategy,
  EffUsernameGeneratorStrategy,
  ForwarderGeneratorStrategy,
} = strategies;

export function legacyUsernameGenerationServiceFactory(
  apiService: ApiService,
  i18nService: I18nService,
  keyService: KeyService,
  encryptService: EncryptService,
  policyService: PolicyService,
  accountService: AccountService,
  stateProvider: StateProvider,
): UsernameGenerationServiceAbstraction {
  const randomizer = new KeyServiceRandomizer(keyService);
  const restClient = new RestClient(apiService, i18nService);
  const usernameRandomizer = new UsernameRandomizer(randomizer);
  const emailRandomizer = new EmailRandomizer(randomizer);
  const emailCalculator = new EmailCalculator();

  const effUsername = new DefaultGeneratorService(
    new EffUsernameGeneratorStrategy(usernameRandomizer, stateProvider),
    policyService,
  );

  const subaddress = new DefaultGeneratorService(
    new SubaddressGeneratorStrategy(emailCalculator, emailRandomizer, stateProvider),
    policyService,
  );

  const catchall = new DefaultGeneratorService(
    new CatchallGeneratorStrategy(emailCalculator, emailRandomizer, stateProvider),
    policyService,
  );

  const addyIo = new DefaultGeneratorService(
    new ForwarderGeneratorStrategy(
      Integrations.AddyIo,
      restClient,
      i18nService,
      encryptService,
      keyService,
      stateProvider,
    ),
    policyService,
  );

  const duckDuckGo = new DefaultGeneratorService(
    new ForwarderGeneratorStrategy(
      Integrations.DuckDuckGo,
      restClient,
      i18nService,
      encryptService,
      keyService,
      stateProvider,
    ),
    policyService,
  );

  const fastmail = new DefaultGeneratorService(
    new ForwarderGeneratorStrategy(
      Integrations.Fastmail,
      restClient,
      i18nService,
      encryptService,
      keyService,
      stateProvider,
    ),
    policyService,
  );

  const firefoxRelay = new DefaultGeneratorService(
    new ForwarderGeneratorStrategy(
      Integrations.FirefoxRelay,
      restClient,
      i18nService,
      encryptService,
      keyService,
      stateProvider,
    ),
    policyService,
  );

  const forwardEmail = new DefaultGeneratorService(
    new ForwarderGeneratorStrategy(
      Integrations.ForwardEmail,
      restClient,
      i18nService,
      encryptService,
      keyService,
      stateProvider,
    ),
    policyService,
  );

  const simpleLogin = new DefaultGeneratorService(
    new ForwarderGeneratorStrategy(
      Integrations.SimpleLogin,
      restClient,
      i18nService,
      encryptService,
      keyService,
      stateProvider,
    ),
    policyService,
  );

  const navigation = new DefaultGeneratorNavigationService(stateProvider, policyService);

  return new LegacyUsernameGenerationService(
    accountService,
    navigation,
    catchall,
    effUsername,
    subaddress,
    addyIo,
    duckDuckGo,
    fastmail,
    firefoxRelay,
    forwardEmail,
    simpleLogin,
  );
}
