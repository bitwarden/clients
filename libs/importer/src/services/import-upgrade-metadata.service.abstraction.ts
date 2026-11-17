import { Observable } from "rxjs";

import { DataLoader } from "../metadata";
import { UpgradeImportType } from "../models/import-upgrade-options";

// TODO: remove once pm-35053-import-upgrade is retired

/** The loaders available for a format on the current client/machine. Everything else about an
 *  importer (name, instructions, accepted file types, ...) is static — read it directly from
 *  `importUpgradeOptions` in `models/import-upgrade-options.ts` instead of through this service. */
export type ImporterUpgradeCapabilities = {
  type: UpgradeImportType;
  loaders: DataLoader[];
};

export type ImporterProfile = { id: string; name: string };

/** A decrypted Chromium login, or why it failed. Never log `login` — only `failure.error` is safe. */
export type ImporterLoginResult = {
  login?: { url: string; username: string; password: string; note: string };
  failure?: { url: string; username: string; error: string };
};

/** Despite the name, `getChromiumLogins` returns real decrypted credentials, not just metadata. */
export abstract class ImportUpgradeMetadataServiceAbstraction {
  abstract init(): Promise<void>;

  /** describes the loaders available for a format on this client/machine */
  abstract metadata$: (
    type$: Observable<UpgradeImportType>,
  ) => Observable<ImporterUpgradeCapabilities>;

  /** Local browser profiles available for a chromium-family vendor's installed browser. Only
   *  available on Desktop. */
  abstract getAvailableProfiles(type: UpgradeImportType): Promise<ImporterProfile[]>;

  /** Reads decrypted logins from a browser profile. Desktop only. Never log the result. */
  abstract getChromiumLogins(
    type: UpgradeImportType,
    profileId: string,
  ): Promise<ImporterLoginResult[]>;
}
