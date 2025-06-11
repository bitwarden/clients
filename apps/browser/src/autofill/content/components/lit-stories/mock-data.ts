import { ProductTierType } from "@bitwarden/common/billing/enums";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

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
  appName: "Bitwarden",
  atRiskPassword: "At-risk password",
  atRiskNavigatePrompt:
    "$ORGANIZATION$ wants you to change this password because it is at-risk. Navigate to your account settings to change the password.",
  atRiskChangePrompt:
    "Your password for this site is at-risk. $ORGANIZATION$ has requested that you change it.",
  changePassword: "Change password",
  close: "Close",
  collection: "Collection",
  folder: "Folder",
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
  never: "Never",
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
  saveAction: "Save",
  saveAsNewLoginAction: "Save as new login",
  saveFailure: "Error saving",
  saveFailureDetails: "Oh no! We couldn't save this. Try entering the details manually.",
  saveLogin: "Save login",
  selectItemAriaLabel: "Select $ITEMTYPE$, $ITEMNAME$",
  typeLogin: "Login",
  unlockToSave: "Unlock to save this login",
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
