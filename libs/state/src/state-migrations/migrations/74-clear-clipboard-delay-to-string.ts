// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

// Old integer values that might exist in user data
const OLD_CLEAR_CLIPBOARD_DELAY_VALUES = {
  NEVER: null as null,
  TEN_SECONDS: 10,
  TWENTY_SECONDS: 20,
  THIRTY_SECONDS: 30,
  ONE_MINUTE: 60,
  TWO_MINUTES: 120,
  FIVE_MINUTES: 300,
} as const;

// New string values
const NEW_CLEAR_CLIPBOARD_DELAY_VALUES = {
  NEVER: "never",
  TEN_SECONDS: "tenSeconds",
  TWENTY_SECONDS: "twentySeconds",
  THIRTY_SECONDS: "thirtySeconds",
  ONE_MINUTE: "oneMinute",
  TWO_MINUTES: "twoMinutes",
  FIVE_MINUTES: "fiveMinutes",
} as const;

type OldClearClipboardDelaySetting =
  (typeof OLD_CLEAR_CLIPBOARD_DELAY_VALUES)[keyof typeof OLD_CLEAR_CLIPBOARD_DELAY_VALUES];
type NewClearClipboardDelaySetting =
  (typeof NEW_CLEAR_CLIPBOARD_DELAY_VALUES)[keyof typeof NEW_CLEAR_CLIPBOARD_DELAY_VALUES];

const CLEAR_CLIPBOARD_DELAY_KEY: KeyDefinitionLike = {
  stateDefinition: {
    name: "autofillSettingsLocal",
  },
  key: "clearClipboardDelay",
};

export class ClearClipboardDelayToStringMigrator extends Migrator<73, 74> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts();

    await Promise.all(accounts.map(({ userId }) => this.migrateAccount(helper, userId)));
  }

  private async migrateAccount(helper: MigrationHelper, userId: string): Promise<void> {
    const oldValue: OldClearClipboardDelaySetting = await helper.getFromUser(
      userId,
      CLEAR_CLIPBOARD_DELAY_KEY,
    );

    // Skip if no value exists
    if (oldValue === undefined) {
      return;
    }

    let newValue: NewClearClipboardDelaySetting;

    // Convert old integer/null values to new string values
    switch (oldValue) {
      case null:
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.FIVE_MINUTES; // possibly confusing for users who explicitly set "never"
        break;
      case 10:
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.TEN_SECONDS;
        break;
      case 20:
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.TWENTY_SECONDS;
        break;
      case 30:
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.THIRTY_SECONDS;
        break;
      case 60:
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.ONE_MINUTE;
        break;
      case 120:
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.TWO_MINUTES;
        break;
      case 300:
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.FIVE_MINUTES;
        break;
      default:
        // For any unknown values, default to fiveMinutes
        newValue = NEW_CLEAR_CLIPBOARD_DELAY_VALUES.FIVE_MINUTES;
        break;
    }

    // Set the new string value
    await helper.setToUser(userId, CLEAR_CLIPBOARD_DELAY_KEY, newValue);
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts();

    await Promise.all(accounts.map(({ userId }) => this.rollbackAccount(helper, userId)));
  }

  private async rollbackAccount(helper: MigrationHelper, userId: string): Promise<void> {
    const newValue: NewClearClipboardDelaySetting = await helper.getFromUser(
      userId,
      CLEAR_CLIPBOARD_DELAY_KEY,
    );

    // Skip if no value exists
    if (newValue === undefined) {
      return;
    }

    let oldValue: OldClearClipboardDelaySetting;

    // Convert new string values back to old integer/null values
    switch (newValue) {
      case "never":
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.NEVER;
        break;
      case "tenSeconds":
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.TEN_SECONDS;
        break;
      case "twentySeconds":
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.TWENTY_SECONDS;
        break;
      case "thirtySeconds":
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.THIRTY_SECONDS;
        break;
      case "oneMinute":
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.ONE_MINUTE;
        break;
      case "twoMinutes":
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.TWO_MINUTES;
        break;
      case "fiveMinutes":
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.FIVE_MINUTES; // potential loss of data -- might have been null or 300 before migration
        break;
      default:
        // Default fallback
        oldValue = OLD_CLEAR_CLIPBOARD_DELAY_VALUES.NEVER;
        break;
    }

    // Set the old integer/null value
    await helper.setToUser(userId, CLEAR_CLIPBOARD_DELAY_KEY, oldValue);
  }
}
