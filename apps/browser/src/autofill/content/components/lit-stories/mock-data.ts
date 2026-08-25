import { ProductTierType } from "@bitwarden/common/billing/enums";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";

export const mockOrganizations = [
  {
    id: "unique-id0",
    name: "Another personal vault",
  },
  {
    id: "unique-id1",
    name: "Acme, inc",
    productTierType: ProductTierType.Teams,
  },
  {
    id: "unique-id2",
    name: "A Really Long Business Name That Just Kinda Goes On For A Really Long Time",
    productTierType: ProductTierType.TeamsStarter,
  },
  {
    id: "unique-id3",
    name: "Family Vault",
    productTierType: ProductTierType.Families,
  },
  {
    id: "unique-id4",
    name: "Family Vault Trial",
    productTierType: ProductTierType.Free,
  },
  {
    id: "unique-id5",
    name: "Exciting Enterprises, LLC",
    productTierType: ProductTierType.Enterprise,
  },
];

export const mockCollections = [
  {
    id: "collection-id-01",
    name: "A collection for stuff",
    organizationId: mockOrganizations[0].id,
  },
];

export const mockFolders = [
  {
    id: "unique-id1",
    name: "A folder",
  },
  {
    id: "unique-id2",
    name: "Another folder",
  },
  {
    id: "unique-id3",
    name: "One more folder",
  },
  {
    id: "unique-id4",
    name: "Definitely not a folder",
  },
  {
    id: "unique-id5",
    name: "Yet another folder",
  },
  {
    id: "unique-id6",
    name: "Something else entirely, with an essence being completely unfolder-like in all the unimportant ways and none of the important ones",
  },
  {
    id: "unique-id7",
    name: 'A "folder"',
  },
  {
    id: "unique-id8",
    name: "Two folders",
  },
];

export const mockCiphers = [
  {
    id: "1",
    name: "Example Cipher",
    type: CipherType.Login,
    favorite: false,
    reprompt: CipherRepromptType.None,
    icon: {
      imageEnabled: true,
      image: "",
      fallbackImage: "https://example.com/fallback.png",
      icon: "icon-class",
    },
    login: { username: "user@example.com" },
  },
];

export const mockTasks = [
  {
    orgName: "Acme, Inc.",
    remainingTasksCount: 0,
  },
];

export const mockI18n = {
  addNewLoginItemAria: "Add new vault login item, opens in a new window",
  addNewCardItemAria: "Add new vault card item, opens in a new window",
  addNewIdentityItemAria: "Add new vault identity item, opens in a new window",
  addNewVaultItem: "Add new vault item",
  appName: "Bitwarden",
  atRiskPassword: "At-risk password",
  atRiskNavigatePromptV2:
    "Your password for this site is at-risk. $ORGANIZATION$ has requested that you navigate to your account settings and change it.",
  atRiskChangePrompt:
    "Your password for this site is at-risk. $ORGANIZATION$ has requested that you change it.",
  changePassword: "Change password",
  close: "Close",
  collection: "Collection",
  folder: "Folder",
  fillVerificationCode: "Fill verification code",
  fillCredentialsFor: "Fill credentials for",
  fillGeneratedPassword: "Fill generated password",
  generatedPassword: "Generated password",
  regeneratePassword: "Regenerate password",
  lowercaseAriaLabel: "Lowercase",
  uppercaseAriaLabel: "Uppercase",
  hashSignCharacterDescriptor: "Hash sign",
  ampersandCharacterDescriptor: "Ampersand",
  asteriskCharacterDescriptor: "Asterisk",
  exclamationCharacterDescriptor: "Exclamation mark",
  logInWithPasskeyAriaLabel: "Log in with passkey",
  username: "Username",
  cardNumberEndsWith: "card number ends with",
  passkeys: "Passkeys",
  passwords: "Passwords",
  loginSaveSuccess: "Login saved",
  notificationLoginSaveConfirmation: "saved to Bitwarden.",
  loginUpdateSuccess: "Login updated",
  notificationLoginUpdatedConfirmation: "updated in Bitwarden.",
  loginUpdateTaskSuccess:
    "Great job! You took the steps to make you and $ORGANIZATION$ more secure.",
  loginUpdateTaskSuccessAdditional:
    "Thank you for making $ORGANIZATION$ more secure. You have $TASK_COUNT$ more passwords to update.",
  nextSecurityTaskAction: "Change next password",
  newItem: "New item",
  newLogin: "New login",
  newCard: "New card",
  newIdentity: "New identity",
  never: "Never",
  noItemsToShow: "No items to show",
  myVault: "My vault",
  notificationAddDesc: "Should Bitwarden remember this password for you?",
  notificationAddSave: "Save",
  notificationChangeDesc: "Do you want to update this password in Bitwarden?",
  notificationUpdate: "Update",
  notificationEdit: "Edit",
  notificationEditTooltip: "Edit before saving",
  notificationUnlock: "Unlock",
  notificationUnlockDesc: "Unlock your Bitwarden vault to complete the autofill request.",
  notificationViewAria: `View $ITEMNAME$, opens in new window`,
  notificationNewItemAria: "New Item, opens in new window",
  opensInANewWindow: "Opens in a new window",
  saveAction: "Save",
  saveAsNewLoginAction: "Save as new login",
  saveFailure: "Error saving",
  saveFailureDetails: "Oh no! We couldn't save this. Try entering the details manually.",
  saveLogin: "Save login",
  saveToBitwarden: "Save to Bitwarden",
  selectItemAriaLabel: "Select $ITEMTYPE$, $ITEMNAME$",
  totpCodeAria: "Time-based One-Time Password Verification Code",
  typeLogin: "Login",
  unlockAccount: "Unlock account",
  unlockAccountAria: "Unlock your account, opens in a new window",
  unlockToSave: "Unlock to save this login",
  unlockYourAccountToViewAutofillSuggestions: "Unlock your account to view autofill suggestions",
  updateLoginAction: "Update login",
  updateLogin: "Update existing login",
  vault: "Vault",
  view: "View",
} as const;

type i18nMessageName = keyof typeof mockI18n;
type i18nMessageValue = (typeof mockI18n)[i18nMessageName];

/**
 * Very basic mock of {@link chrome.i18n.getMessage} to enable stories
 *
 * @param {i18nMessageName} messageName must match a key in {@link mockI18n}
 * @param {(string | string[])} [substitutions]
 * @return {*}  {(i18nMessageValue | string)}
 */
export function mockBrowserI18nGetMessage(
  messageName: i18nMessageName,
  substitutions?: string | string[],
): i18nMessageValue | string {
  let normalizedSubstitutions: string[] = [];

  if (substitutions) {
    normalizedSubstitutions =
      typeof substitutions === "string"
        ? [substitutions]
        : substitutions.length
          ? substitutions
          : [];
  }

  if (normalizedSubstitutions.length) {
    const resolvedString = normalizedSubstitutions.reduce((builtString, substitution) => {
      // Replace first found match each iteration, in order
      return builtString.replace(/\$[A-Z_]+\$/, substitution);
    }, mockI18n[messageName] || "");

    return resolvedString;
  }

  return mockI18n[messageName];
}

const mockInlineMenuIcon = {
  imageEnabled: false,
  image: "",
  fallbackImage: "",
  icon: "globe",
};

export function makeCipher(
  overrides: Partial<InlineMenuCipherData> & Pick<InlineMenuCipherData, "id" | "name" | "type">,
): InlineMenuCipherData {
  return {
    favorite: false,
    reprompt: CipherRepromptType.None,
    icon: mockInlineMenuIcon,
    ...overrides,
  };
}

export const mockLoginCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "bitwarden.com",
    type: CipherType.Login,
    login: { username: "test@bitwarden.com", passkey: null },
  }),
  makeCipher({
    id: "2",
    name: "example.com",
    type: CipherType.Login,
    login: { username: "codestradamus", passkey: null },
  }),
  makeCipher({
    id: "3",
    name: "A really long site name that should ellipsize in the list",
    type: CipherType.Login,
    login: { username: "long.username@example.com", passkey: null },
  }),
];

export const mockTotpCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "site-a",
    type: CipherType.Login,
    login: {
      username: "alice@example.com",
      totp: "454143",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  }),
  makeCipher({
    id: "2",
    name: "site-b",
    type: CipherType.Login,
    login: {
      username: "liz@example.com",
      totp: "174593",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  }),
];

export const mockPasskeyCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "bitwarden.com",
    type: CipherType.Login,
    login: {
      username: "test@bitwarden.com",
      passkey: {
        rpName: "Bitwarden",
        userName: "test@bitwarden.com",
      },
    },
  }),
  makeCipher({
    id: "2",
    name: "Example Site",
    type: CipherType.Login,
    login: {
      passkey: {
        rpName: "Example Site",
        userName: "passkey-user",
      },
    },
  }),
];

export const mockPasskeysAndPasswords: InlineMenuCipherData[] = [
  ...mockPasskeyCiphers,
  makeCipher({
    id: "3",
    name: "bitwarden.com",
    type: CipherType.Login,
    login: { username: "password-user@bitwarden.com", passkey: null },
  }),
];

export const mockCardCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "Personal Visa",
    type: CipherType.Card,
    card: "Visa, *4242",
  }),
  makeCipher({
    id: "2",
    name: "Work Amex",
    type: CipherType.Card,
    card: "Amex, *10005",
  }),
];

export const mockIdentityCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "Home Address",
    type: CipherType.Identity,
    identity: { fullName: "Jane Doe" },
  }),
  makeCipher({
    id: "2",
    name: "Work Profile",
    type: CipherType.Identity,
    identity: { fullName: "Jane Doe", username: "jane.doe@bitwarden.com" },
  }),
];

export const mockPasswordGeneratorI18n = {
  generatedPassword: mockI18n.generatedPassword,
  lowercaseAriaLabel: mockI18n.lowercaseAriaLabel,
  uppercaseAriaLabel: mockI18n.uppercaseAriaLabel,
  regeneratePassword: mockI18n.regeneratePassword,
  characterDescriptors: {
    hashSignCharacterDescriptor: mockI18n.hashSignCharacterDescriptor,
    ampersandCharacterDescriptor: mockI18n.ampersandCharacterDescriptor,
    asteriskCharacterDescriptor: mockI18n.asteriskCharacterDescriptor,
    exclamationCharacterDescriptor: mockI18n.exclamationCharacterDescriptor,
  },
};

export const mockCipherListI18n = {
  viewButtonText: mockI18n.view,
  opensInANewWindowText: mockI18n.opensInANewWindow,
  fillCredentialsForText: mockI18n.fillCredentialsFor,
  logInWithPasskeyAriaLabel: mockI18n.logInWithPasskeyAriaLabel,
  usernameText: mockI18n.username,
  cardNumberEndsWithText: mockI18n.cardNumberEndsWith,
  fillVerificationCodeText: mockI18n.fillVerificationCode,
  totpCodeAria: mockI18n.totpCodeAria,
  passkeysText: mockI18n.passkeys,
  passwordsText: mockI18n.passwords,
};
