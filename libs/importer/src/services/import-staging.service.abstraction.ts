import { Observable } from "rxjs";

import { ImportType } from "../models/import-options";
import { ImportResult } from "../models/import-result";
import { UpgradeImportType } from "../models/import-upgrade-options";
import { SdkImportCredentials } from "../sdk";

/** A parsed import, staged for passing to a specific vault.
 * In memory only: it holds decrypted vault data and credentials. */
export type StagedImport =
  | {
      kind: "file";
      importType: UpgradeImportType;
      format: UpgradeImportType;
      contents: string;
      filePassword: string | null;
      itemCount: number | undefined;
    }
  /** Fetched and converted without an organization*/
  | { kind: "parsed"; importType: UpgradeImportType; result: ImportResult }
  /** Parsed and written by the SDK in one call, so the file and credentials wait for location */
  | { kind: "sdk"; format: ImportType; file: Uint8Array; credentials: SdkImportCredentials };

export abstract class ImportStagingServiceAbstraction {
  abstract readonly staged$: Observable<StagedImport | undefined>;
  abstract current(): StagedImport | undefined;
  abstract stage(staged: StagedImport): void;
  /** Drops everything staged and zeroes the file and key-file bytes. */
  abstract clear(): void;
}
