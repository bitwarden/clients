// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

/** settings targeted by migrator */
export type AccountType = {
  settings?: {
    usernameGenerationOptions?: ExpectedOptions;
  };
};

/** username generation options prior to refactoring */
export type ExpectedOptions = {
  type?: "word" | "subaddress" | "catchall" | "forwarded";
  wordCapitalize?: boolean;
  wordIncludeNumber?: boolean;
  subaddressType?: "random" | "website-name";
  subaddressEmail?: string;
  catchallType?: "random" | "website-name";
  catchallDomain?: string;
  forwardedService?: string;
  forwardedAnonAddyApiToken?: string;
  forwardedAnonAddyDomain?: string;
  forwardedAnonAddyBaseUrl?: string;
  forwardedDuckDuckGoToken?: string;
  forwardedFirefoxApiToken?: string;
  forwardedFastmailApiToken?: string;
  forwardedForwardEmailApiToken?: string;
  forwardedForwardEmailDomain?: string;
  forwardedSimpleLoginApiKey?: string;
  forwardedSimpleLoginBaseUrl?: string;
};

/** username generation options after refactoring */
type ConvertedOptions = {
  generator: GeneratorNavigation;
  algorithms: {
    catchall: CatchallGenerationOptions;
    effUsername: EffUsernameGenerationOptions;
    subaddress: SubaddressGenerationOptions;
  };
  forwarders: {
    addyIo: SelfHostedApiOptions & EmailDomainOptions;
    duckDuckGo: ApiOptions;
    fastmail: ApiOptions;
    firefoxRelay: ApiOptions;
    forwardEmail: ApiOptions & EmailDomainOptions;
    simpleLogin: SelfHostedApiOptions;
  };
};

export const NAVIGATION: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "generatorSettings",
};

export const CATCHALL: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "catchallGeneratorSettings",
};

export const EFF_USERNAME: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "effUsernameGeneratorSettings",
};

export const SUBADDRESS: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "subaddressGeneratorSettings",
};

export const ADDY_IO: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "addyIoBuffer",
};

export const DUCK_DUCK_GO: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "duckDuckGoBuffer",
};

export const FASTMAIL: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "fastmailBuffer",
};

export const FIREFOX_RELAY: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "firefoxRelayBuffer",
};

export const FORWARD_EMAIL: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "forwardEmailBuffer",
};

export const SIMPLE_LOGIN: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "simpleLoginBuffer",
};

export type GeneratorNavigation = {
  type?: string;
  username?: string;
  forwarder?: string;
};

type UsernameGenerationMode = "random" | "website-name";

type CatchallGenerationOptions = {
  catchallType?: UsernameGenerationMode;
  catchallDomain?: string;
};

type EffUsernameGenerationOptions = {
  wordCapitalize?: boolean;
  wordIncludeNumber?: boolean;
};

type SubaddressGenerationOptions = {
  subaddressType?: UsernameGenerationMode;
  subaddressEmail?: string;
};

type ApiOptions = {
  token?: string;
};

type SelfHostedApiOptions = ApiOptions & {
  baseUrl: string;
};

type EmailDomainOptions = {
  domain: string;
};

export class ForwarderOptionsMigrator extends Migrator<64, 65> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<AccountType>();

    async function migrateAccount(userId: string, account: AccountType) {
      const legacyOptions = account?.settings?.usernameGenerationOptions;

      if (legacyOptions) {
        const converted = convertSettings(legacyOptions);
        await storeSettings(helper, userId, converted);
        await deleteSettings(helper, userId, account);
      }
    }

    await Promise.all([...accounts.map(({ userId, account }) => migrateAccount(userId, account))]);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    // not supported
  }
}

function convertSettings(options: ExpectedOptions): ConvertedOptions {
  const forwarders = {
    addyIo: {
      baseUrl: options.forwardedAnonAddyBaseUrl,
      token: options.forwardedAnonAddyApiToken,
      domain: options.forwardedAnonAddyDomain,
    },
    duckDuckGo: {
      token: options.forwardedDuckDuckGoToken,
    },
    fastmail: {
      token: options.forwardedFastmailApiToken,
    },
    firefoxRelay: {
      token: options.forwardedFirefoxApiToken,
    },
    forwardEmail: {
      token: options.forwardedForwardEmailApiToken,
      domain: options.forwardedForwardEmailDomain,
    },
    simpleLogin: {
      token: options.forwardedSimpleLoginApiKey,
      baseUrl: options.forwardedSimpleLoginBaseUrl,
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
    },
    subaddress: {
      subaddressType: options.subaddressType,
      subaddressEmail: options.subaddressEmail,
    },
    catchall: {
      catchallType: options.catchallType,
      catchallDomain: options.catchallDomain,
    },
  };

  return { generator, algorithms, forwarders };
}

async function storeSettings(helper: MigrationHelper, userId: string, converted: ConvertedOptions) {
  await Promise.all([
    helper.setToUser(userId, NAVIGATION, converted.generator),
    helper.setToUser(userId, CATCHALL, converted.algorithms.catchall),
    helper.setToUser(userId, EFF_USERNAME, converted.algorithms.effUsername),
    helper.setToUser(userId, SUBADDRESS, converted.algorithms.subaddress),
    helper.setToUser(userId, ADDY_IO, converted.forwarders.addyIo),
    helper.setToUser(userId, DUCK_DUCK_GO, converted.forwarders.duckDuckGo),
    helper.setToUser(userId, FASTMAIL, converted.forwarders.fastmail),
    helper.setToUser(userId, FIREFOX_RELAY, converted.forwarders.firefoxRelay),
    helper.setToUser(userId, FORWARD_EMAIL, converted.forwarders.forwardEmail),
    helper.setToUser(userId, SIMPLE_LOGIN, converted.forwarders.simpleLogin),
  ]);
}

async function deleteSettings(helper: MigrationHelper, userId: string, account: AccountType) {
  delete account?.settings?.usernameGenerationOptions;
  await helper.set(userId, account);
}
