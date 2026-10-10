import { Observable } from "rxjs";

import { DataLoader } from "../metadata";
import { ImportType } from "../models/import-options";

/** The loaders available for a format on the current client/machine. Everything else about an
 *  importer (name, instructions, accepted file types, ...) is static — read it directly from
 *  `importOptions` in `models/import-options.ts` instead of through this service. */
export type ImporterCapabilities = {
  type: ImportType;
  loaders: DataLoader[];
};

export type ImporterProfile = { id: string; name: string };

/** A decrypted Chromium login, or why it failed. Never log `login` — only `failure.error` is safe. */
export type ImporterLoginResult = {
  login?: { url: string; username: string; password: string; note: string };
  failure?: { url: string; username: string; error: string };
};

/** Despite the name, `getChromiumLogins` returns real decrypted credentials, not just metadata. */
export abstract class ImportMetadataServiceAbstraction {
  abstract init(): Promise<void>;

  /** describes the loaders available for a format on this client/machine */
  abstract metadata$: (type$: Observable<ImportType>) => Observable<ImporterCapabilities>;

  /** Local browser profiles available for a chromium-family vendor's installed browser. Only
   *  available on Desktop. */
  abstract getAvailableProfiles(type: ImportType): Promise<ImporterProfile[]>;

  /** Reads decrypted logins from a browser profile. Desktop only. Never log the result. */
  abstract getChromiumLogins(type: ImportType, profileId: string): Promise<ImporterLoginResult[]>;
}
