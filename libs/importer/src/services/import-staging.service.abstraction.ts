import { Observable } from "rxjs";

import { ImportType } from "../models/import-options";
import { ImportResult } from "../models/import-result";
import { UpgradeImportType } from "../models/import-upgrade-options";
import { ImportedFile } from "../models/imported-file";
import { SdkImportCredentials } from "../sdk";

import { ItemTypeCounts } from "./item-type-counts";

/** A parsed import, staged for passing to a specific vault.
 * In memory only: it holds decrypted vault data and credentials. */
export type StagedImport =
  | {
      kind: "file";
      importType: UpgradeImportType;
      format: UpgradeImportType;
      contents: string;
      filePassword: string | null;
      itemTypeCounts: ItemTypeCounts | undefined;
      /** Set when the user picked a file, so the confirmation can remind them to delete it. */
      importedFile?: ImportedFile;
    }
  /** Fetched and converted without an organization*/
  | { kind: "parsed"; importType: UpgradeImportType; result: ImportResult }
  /** Parsed and written by the SDK in one call, so the file and credentials wait for location */
  | {
      kind: "sdk";
      format: ImportType;
      file: Uint8Array;
      credentials: SdkImportCredentials;
      importedFile?: ImportedFile;
    };

/** A KeePass import the SDK rejected on the location step, handed back to the step that chose the
 *  file so the user can fix it. In memory only: it holds the file, key file and password. */
export interface FileStepReturn {
  format: ImportType;
  file: { name: string; bytes: Uint8Array };
  password: string;
  keyFile: { name: string; bytes: Uint8Array } | null;
  /** Which field shows the error, and the key and arguments of its message. */
  error: { field: "file" | "kdbxPassword"; messageKey: string; args?: string[] };
}

export abstract class ImportStagingServiceAbstraction {
  abstract readonly staged$: Observable<StagedImport | undefined>;
  abstract current(): StagedImport | undefined;
  abstract stage(staged: StagedImport): void;
  /** Drops everything staged and zeroes the file and key-file bytes. */
  abstract clear(): void;
  /** Kept apart from the staged import: leaving the location step clears that, not this. */
  abstract returnToFileStep(state: FileStepReturn): void;
  /** Hands the returned import over once; the caller zeroes its bytes after use. */
  abstract takeFileStepReturn(): FileStepReturn | undefined;
  /** Zeroes and drops a returned import nobody took. */
  abstract discardFileStepReturn(): void;
}
