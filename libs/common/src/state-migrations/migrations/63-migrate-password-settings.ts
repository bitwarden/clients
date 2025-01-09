import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

/** settings targeted by migrator */
export type AccountType = {
  settings?: {
    passwordGenerationOptions?: ExpectedOptions;
  };
};

export type GeneratorType = "password" | "passphrase" | "username";

/** username generation options prior to refactoring */
export type ExpectedOptions = {
  type?: GeneratorType;
  length?: number;
  minLength?: number;
  ambiguous?: boolean;
  uppercase?: boolean;
  minUppercase?: number;
  lowercase?: boolean;
  minLowercase?: number;
  number?: boolean;
  minNumber?: number;
  special?: boolean;
  minSpecial?: number;
  numWords?: number;
  wordSeparator?: string;
  capitalize?: boolean;
  includeNumber?: boolean;
};

/** username generation options after refactoring */
type ConvertedOptions = {
  generator: GeneratorNavigation;
  password: PasswordGenerationOptions;
  passphrase: PassphraseGenerationOptions;
};

export const NAVIGATION: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "generatorSettings",
};

export const PASSWORD: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "passwordGeneratorSettings",
};

export const PASSPHRASE: KeyDefinitionLike = {
  stateDefinition: {
    name: "generator",
  },
  key: "passphraseGeneratorSettings",
};

export type GeneratorNavigation = {
  type?: string;
};

export type PassphraseGenerationOptions = {
  numWords?: number;
  wordSeparator?: string;
  capitalize?: boolean;
  includeNumber?: boolean;
};

export type PasswordGenerationOptions = {
  length?: number;
  minLength?: number;
  ambiguous?: boolean;
  uppercase?: boolean;
  minUppercase?: number;
  lowercase?: boolean;
  minLowercase?: number;
  number?: boolean;
  minNumber?: number;
  special?: boolean;
  minSpecial?: number;
};

export class PasswordOptionsMigrator extends Migrator<62, 63> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<AccountType>();

    async function migrateAccount(userId: string, account: AccountType) {
      const legacyOptions = account?.settings?.passwordGenerationOptions;

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
  const password = {
    length: options.length,
    ambiguous: options.ambiguous,
    uppercase: options.uppercase,
    minUppercase: options.minUppercase,
    lowercase: options.lowercase,
    minLowercase: options.minLowercase,
    number: options.number,
    minNumber: options.minNumber,
    special: options.special,
    minSpecial: options.minSpecial,
  };

  const generator = {
    type: options.type,
  };

  const passphrase = {
    numWords: options.numWords,
    wordSeparator: options.wordSeparator,
    capitalize: options.capitalize,
    includeNumber: options.includeNumber,
  };

  return { generator, password, passphrase };
}

async function storeSettings(helper: MigrationHelper, userId: string, converted: ConvertedOptions) {
  const existing = (await helper.getFromUser(userId, NAVIGATION)) ?? {};
  const updated = Object.assign(existing, converted.generator);

  await Promise.all([
    helper.setToUser(userId, NAVIGATION, updated),
    helper.setToUser(userId, PASSPHRASE, converted.passphrase),
    helper.setToUser(userId, PASSWORD, converted.password),
  ]);
}

async function deleteSettings(helper: MigrationHelper, userId: string, account: AccountType) {
  delete account?.settings?.passwordGenerationOptions;
  await helper.set(userId, account);
}
