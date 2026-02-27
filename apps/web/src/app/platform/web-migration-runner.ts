import { ClientType } from "@bitwarden/common/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { WindowStorageService } from "@bitwarden/common/platform/storage/window-storage.service";
import { MigrationHelper } from "@bitwarden/common/state-migrations/migration-helper";

export class WebMigrationRunner extends MigrationRunner {
  constructor(
    diskStorage: AbstractStorageService,
    logService: LogService,
    migrationBuilderService: MigrationBuilderService,
    private diskLocalStorage: WindowStorageService,
  ) {
    super(diskStorage, logService, migrationBuilderService, ClientType.Web);
  }

  override async run(): Promise<void> {
    // Run the default migration against session storage
    await super.run();

    // run web disk local specific migrations
    const migrationBuilder = this.migrationBuilderService.build();

    let stateVersion = await this.diskLocalStorage.get<number | null>("stateVersion");
    if (stateVersion == null) {
      // Web has never stored a state version in disk local before
      // TODO: Is this a good number?
      stateVersion = 12;
    }

    // Run migrations again specifically for web `localStorage`.
    const helper = new WebMigrationHelper(stateVersion, this.diskLocalStorage, this.logService);

    await migrationBuilder.migrate(helper);
  }
}

class WebMigrationHelper extends MigrationHelper {
  private readonly diskLocalStorageService: WindowStorageService;

  constructor(
    currentVersion: number,
    storageService: WindowStorageService,
    logService: LogService,
  ) {
    super(currentVersion, storageService, logService, "web-disk-local", ClientType.Web);
    this.diskLocalStorageService = storageService;
  }

  override async getAccounts<ExpectedAccountType>(): Promise<
    { userId: string; account: ExpectedAccountType }[]
  > {
    // Get all the keys of things stored in `localStorage`
    const keys = this.diskLocalStorageService.getKeys();

    const accounts: { userId: string; account: ExpectedAccountType }[] = [];

    for (const key of keys) {
      // Is this is likely a userid
      if (!Utils.isGuid(key)) {
        continue;
      }

      const accountCandidate = await this.diskLocalStorageService.get(key);

      // If there isn't data at that key location, don't bother
      if (accountCandidate == null) {
        continue;
      }

      // The legacy account object was always an object, if
      // it is some other primitive, it's like a false positive.
      if (typeof accountCandidate !== "object") {
        continue;
      }

      accounts.push({ userId: key, account: accountCandidate as ExpectedAccountType });
    }

    // TODO: Cache this for future calls?
    return accounts;
  }
}
