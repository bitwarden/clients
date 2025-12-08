// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

type NeverDomains = { [id: string]: unknown };

type ExpectedAccountType = {
  settings?: {
    neverDomains?: NeverDomains;
    disableAddLoginNotification?: boolean;
    disableChangedPasswordNotification?: boolean;
    disableContextMenuItem?: boolean;
  };
};

type TargetGlobalState = {
  neverDomains?: NeverDomains;
  disableAddLoginNotification?: boolean;
  disableChangedPasswordNotification?: boolean;
  disableContextMenuItem?: boolean;
};

export class MoveBrowserSettingsToGlobal extends Migrator<8, 9> {
  // Will first check if any of the accounts have a value from the given accountSelector
  // if they do have a value it will set that value into global state but if multiple
  // users have differing values it will prefer the false setting,
  // if all users have true then it will take true.
  tryAddSetting(
    accounts: { userId: string; account: ExpectedAccountType }[],
    accountSelector: (account: ExpectedAccountType) => boolean | undefined,
    globalSetter: (value: boolean | undefined) => void,
  ): void {
    const hasValue = accounts.some(({ account }) => {
      return accountSelector(account) !== undefined;
    });

    if (hasValue) {
      const value = !accounts.some(({ account }) => {
        return (accountSelector(account) ?? false) === false;
      });

      globalSetter(value);
    }
  }

  async migrate(helper: MigrationHelper): Promise<void> {
    const global = await helper.get<object>("global");

    const accounts = await helper.getAccounts<ExpectedAccountType>();

    const globalNeverDomainsValue = accounts.reduce((accumulator, { account }) => {
      const normalizedNeverDomains = account.settings?.neverDomains ?? {};
      for (const [id, value] of Object.entries(normalizedNeverDomains)) {
        accumulator ??= {};
        accumulator[id] = value;
      }
      return accumulator;
    }, undefined as NeverDomains);

    const targetGlobalState: TargetGlobalState = {};

    if (globalNeverDomainsValue != null) {
      targetGlobalState.neverDomains = globalNeverDomainsValue;
    }

    this.tryAddSetting(
      accounts,
      (a) => a.settings?.disableAddLoginNotification,
      (v) => (targetGlobalState.disableAddLoginNotification = v),
    );

    this.tryAddSetting(
      accounts,
      (a) => a.settings?.disableChangedPasswordNotification,
      (v) => (targetGlobalState.disableChangedPasswordNotification = v),
    );

    this.tryAddSetting(
      accounts,
      (a) => a.settings?.disableContextMenuItem,
      (v) => (targetGlobalState.disableContextMenuItem = v),
    );

    await helper.set<TargetGlobalState>("global", {
      ...global,
      ...targetGlobalState,
    });

    await Promise.all(
      accounts.map(async ({ userId, account }) => {
        delete account.settings?.disableAddLoginNotification;
        delete account.settings?.disableChangedPasswordNotification;
        delete account.settings?.disableContextMenuItem;
        delete account.settings?.neverDomains;
        await helper.set(userId, account);
      }),
    );
  }

  rollback(helper: MigrationHelper): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
