// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { zip, firstValueFrom, map, concatMap, combineLatest } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Vendor } from "@bitwarden/common/tools/extension/vendor/data";
import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";
import { UserId } from "@bitwarden/common/types/guid";
import {
  ApiOptions,
  EmailDomainOptions,
  EmailPrefixOptions,
  SelfHostedApiOptions,
  NoPolicy,
  GeneratorService,
  CatchallGenerationOptions,
  EffUsernameGenerationOptions,
  SubaddressGenerationOptions,
  UsernameGeneratorType,
  ForwarderId,
} from "@bitwarden/generator-core";
import { GeneratorNavigationService, GeneratorNavigation } from "@bitwarden/generator-navigation";

import { Forwarders } from "./forwarders";
import { UsernameGeneratorOptions } from "./username-generation-options";
import { UsernameGenerationServiceAbstraction } from "./username-generation.service.abstraction";

type MappedOptions = {
  generator: GeneratorNavigation;
  algorithms: {
    catchall: CatchallGenerationOptions;
    effUsername: EffUsernameGenerationOptions;
    subaddress: SubaddressGenerationOptions;
  };
  forwarders: {
    addyIo: SelfHostedApiOptions & EmailDomainOptions & IntegrationRequest;
    duckDuckGo: ApiOptions & IntegrationRequest;
    fastmail: ApiOptions & EmailPrefixOptions & IntegrationRequest;
    firefoxRelay: ApiOptions & IntegrationRequest;
    forwardEmail: ApiOptions & EmailDomainOptions & IntegrationRequest;
    simpleLogin: SelfHostedApiOptions & IntegrationRequest;
  };
};

/** Adapts the generator 2.0 design to 1.0 angular services. */
export class LegacyUsernameGenerationService implements UsernameGenerationServiceAbstraction {
  constructor(
    private readonly accountService: AccountService,
    private readonly navigation: GeneratorNavigationService,
    private readonly catchall: GeneratorService<CatchallGenerationOptions, NoPolicy>,
    private readonly effUsername: GeneratorService<EffUsernameGenerationOptions, NoPolicy>,
    private readonly subaddress: GeneratorService<SubaddressGenerationOptions, NoPolicy>,
    private readonly addyIo: GeneratorService<SelfHostedApiOptions & EmailDomainOptions, NoPolicy>,
    private readonly duckDuckGo: GeneratorService<ApiOptions, NoPolicy>,
    private readonly fastmail: GeneratorService<ApiOptions & EmailPrefixOptions, NoPolicy>,
    private readonly firefoxRelay: GeneratorService<ApiOptions, NoPolicy>,
    private readonly forwardEmail: GeneratorService<ApiOptions & EmailDomainOptions, NoPolicy>,
    private readonly simpleLogin: GeneratorService<SelfHostedApiOptions, NoPolicy>,
  ) {}

  generateUsername(options: UsernameGeneratorOptions) {
    if (options.type === "catchall") {
      return this.generateCatchall(options);
    } else if (options.type === "subaddress") {
      return this.generateSubaddress(options);
    } else if (options.type === "forwarded") {
      return this.generateForwarded(options);
    } else {
      return this.generateWord(options);
    }
  }

  generateWord(options: UsernameGeneratorOptions) {
    return this.effUsername.generate(options);
  }

  generateSubaddress(options: UsernameGeneratorOptions) {
    return this.subaddress.generate(options);
  }

  generateCatchall(options: UsernameGeneratorOptions) {
    return this.catchall.generate(options);
  }

  generateForwarded(options: UsernameGeneratorOptions) {
    if (!options.forwardedService) {
      return null;
    }

    const stored = this.toStoredOptions(options);
    switch (options.forwardedService) {
      case Forwarders.AddyIo.id:
      case Vendor.addyio:
        return this.addyIo.generate(stored.forwarders.addyIo);
      case Forwarders.DuckDuckGo.id:
        return this.duckDuckGo.generate(stored.forwarders.duckDuckGo);
      case Forwarders.Fastmail.id:
        return this.fastmail.generate(stored.forwarders.fastmail);
      case Forwarders.FirefoxRelay.id:
      case Vendor.mozilla:
        return this.firefoxRelay.generate(stored.forwarders.firefoxRelay);
      case Forwarders.ForwardEmail.id:
        return this.forwardEmail.generate(stored.forwarders.forwardEmail);
      case Forwarders.SimpleLogin.id:
        return this.simpleLogin.generate(stored.forwarders.simpleLogin);
    }
  }

  getOptions$() {
    // look upon my works, ye mighty, and despair!
    const options$ = this.accountService.activeAccount$.pipe(
      concatMap((account) =>
        combineLatest([
          this.navigation.options$(account.id),
          this.navigation.defaults$(account.id),
          this.catchall.options$(account.id),
          this.catchall.defaults$(account.id),
          this.effUsername.options$(account.id),
          this.effUsername.defaults$(account.id),
          this.subaddress.options$(account.id),
          this.subaddress.defaults$(account.id),
          this.addyIo.options$(account.id),
          this.addyIo.defaults$(account.id),
          this.duckDuckGo.options$(account.id),
          this.duckDuckGo.defaults$(account.id),
          this.fastmail.options$(account.id),
          this.fastmail.defaults$(account.id),
          this.firefoxRelay.options$(account.id),
          this.firefoxRelay.defaults$(account.id),
          this.forwardEmail.options$(account.id),
          this.forwardEmail.defaults$(account.id),
          this.simpleLogin.options$(account.id),
          this.simpleLogin.defaults$(account.id),
        ]),
      ),
      map(
        ([
          generatorOptions,
          generatorDefaults,
          catchallOptions,
          catchallDefaults,
          effUsernameOptions,
          effUsernameDefaults,
          subaddressOptions,
          subaddressDefaults,
          addyIoOptions,
          addyIoDefaults,
          duckDuckGoOptions,
          duckDuckGoDefaults,
          fastmailOptions,
          fastmailDefaults,
          firefoxRelayOptions,
          firefoxRelayDefaults,
          forwardEmailOptions,
          forwardEmailDefaults,
          simpleLoginOptions,
          simpleLoginDefaults,
        ]) =>
          this.toUsernameOptions({
            generator: generatorOptions ?? generatorDefaults,
            algorithms: {
              catchall: catchallOptions ?? catchallDefaults,
              effUsername: effUsernameOptions ?? effUsernameDefaults,
              subaddress: subaddressOptions ?? subaddressDefaults,
            },
            forwarders: {
              addyIo: addyIoOptions ?? addyIoDefaults,
              duckDuckGo: duckDuckGoOptions ?? duckDuckGoDefaults,
              fastmail: fastmailOptions ?? fastmailDefaults,
              firefoxRelay: firefoxRelayOptions ?? firefoxRelayDefaults,
              forwardEmail: forwardEmailOptions ?? forwardEmailDefaults,
              simpleLogin: simpleLoginOptions ?? simpleLoginDefaults,
            },
          }),
      ),
    );

    return options$;
  }

  getOptions() {
    return firstValueFrom(this.getOptions$());
  }

  async saveOptions(options: UsernameGeneratorOptions) {
    const stored = this.toStoredOptions(options);
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    const saved = await this.saveGeneratorOptions(activeAccount.id, options.type, stored);
    if (!saved) {
      await this.saveForwarderOptions(activeAccount.id, options.forwardedService, stored);
    }

    // run navigation options 2nd so that navigation options update doesn't race the `saved options`
    // update in Firefox.
    await this.saveNavigationOptions(activeAccount.id, stored);
  }

  private async saveNavigationOptions(account: UserId, options: MappedOptions) {
    // generator settings needs to preserve whether password or passphrase is selected,
    // so `navigationOptions` is mutated.
    const navigationOptions$ = zip(
      this.navigation.options$(account),
      this.navigation.defaults$(account),
    ).pipe(map(([options, defaults]) => options ?? defaults));

    let navigationOptions = await firstValueFrom(navigationOptions$);
    navigationOptions = Object.assign(navigationOptions, options.generator);
    await this.navigation.saveOptions(account, navigationOptions);
  }

  private async saveGeneratorOptions(
    account: UserId,
    type: UsernameGeneratorType,
    options: MappedOptions,
  ) {
    switch (type) {
      case "word":
        await this.effUsername.saveOptions(account, options.algorithms.effUsername);
        return true;
      case "subaddress":
        await this.subaddress.saveOptions(account, options.algorithms.subaddress);
        return true;
      case "catchall":
        await this.catchall.saveOptions(account, options.algorithms.catchall);
        return true;
      default:
        return false;
    }
  }

  private async saveForwarderOptions(
    account: UserId,
    forwarder: ForwarderId | "",
    options: MappedOptions,
  ) {
    switch (forwarder) {
      case Forwarders.AddyIo.id:
      case Vendor.addyio:
        await this.addyIo.saveOptions(account, options.forwarders.addyIo);
        return true;
      case Forwarders.DuckDuckGo.id:
        await this.duckDuckGo.saveOptions(account, options.forwarders.duckDuckGo);
        return true;
      case Forwarders.Fastmail.id:
        await this.fastmail.saveOptions(account, options.forwarders.fastmail);
        return true;
      case Forwarders.FirefoxRelay.id:
      case Vendor.mozilla:
        await this.firefoxRelay.saveOptions(account, options.forwarders.firefoxRelay);
        return true;
      case Forwarders.ForwardEmail.id:
        await this.forwardEmail.saveOptions(account, options.forwarders.forwardEmail);
        return true;
      case Forwarders.SimpleLogin.id:
        await this.simpleLogin.saveOptions(account, options.forwarders.simpleLogin);
        return true;
      default:
        return false;
    }
  }

  private toStoredOptions(options: UsernameGeneratorOptions) {
    const forwarders = {
      addyIo: {
        baseUrl: options.forwardedAnonAddyBaseUrl,
        token: options.forwardedAnonAddyApiToken,
        domain: options.forwardedAnonAddyDomain,
        website: options.website,
      },
      duckDuckGo: {
        token: options.forwardedDuckDuckGoToken,
        website: options.website,
      },
      fastmail: {
        token: options.forwardedFastmailApiToken,
        website: options.website,
      },
      firefoxRelay: {
        token: options.forwardedFirefoxApiToken,
        website: options.website,
      },
      forwardEmail: {
        token: options.forwardedForwardEmailApiToken,
        domain: options.forwardedForwardEmailDomain,
        website: options.website,
      },
      simpleLogin: {
        token: options.forwardedSimpleLoginApiKey,
        baseUrl: options.forwardedSimpleLoginBaseUrl,
        website: options.website,
      },
    };

    const generator = {
      username: options.type,
      forwarder: options.forwardedService,
    };

    const algorithms = {
      effUsername: {
        wordCapitalize: options.wordCapitalize,
        wordIncludeNumber: options.wordIncludeNumber,
        website: options.website,
      },
      subaddress: {
        subaddressType: options.subaddressType,
        subaddressEmail: options.subaddressEmail,
        website: options.website,
      },
      catchall: {
        catchallType: options.catchallType,
        catchallDomain: options.catchallDomain,
        website: options.website,
      },
    };

    return { generator, algorithms, forwarders } as MappedOptions;
  }

  private toUsernameOptions(options: MappedOptions) {
    return {
      type: options.generator.username,
      wordCapitalize: options.algorithms.effUsername.wordCapitalize,
      wordIncludeNumber: options.algorithms.effUsername.wordIncludeNumber,
      subaddressType: options.algorithms.subaddress.subaddressType,
      subaddressEmail: options.algorithms.subaddress.subaddressEmail,
      catchallType: options.algorithms.catchall.catchallType,
      catchallDomain: options.algorithms.catchall.catchallDomain,
      forwardedService: options.generator.forwarder,
      forwardedAnonAddyApiToken: options.forwarders.addyIo.token,
      forwardedAnonAddyDomain: options.forwarders.addyIo.domain,
      forwardedAnonAddyBaseUrl: options.forwarders.addyIo.baseUrl,
      forwardedDuckDuckGoToken: options.forwarders.duckDuckGo.token,
      forwardedFirefoxApiToken: options.forwarders.firefoxRelay.token,
      forwardedFastmailApiToken: options.forwarders.fastmail.token,
      forwardedForwardEmailApiToken: options.forwarders.forwardEmail.token,
      forwardedForwardEmailDomain: options.forwarders.forwardEmail.domain,
      forwardedSimpleLoginApiKey: options.forwarders.simpleLogin.token,
      forwardedSimpleLoginBaseUrl: options.forwarders.simpleLogin.baseUrl,
    } as UsernameGeneratorOptions;
  }
}
