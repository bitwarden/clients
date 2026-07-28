import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { CredentialKind } from "./credential-kind";
import { SdkImportCredentials } from "./sdk-import-credentials";
import { SdkImportSummary } from "./sdk-import-summary";

/** Generic, importer-agnostic context for an SDK import. */
export interface SdkImportContext {
  /** When set, import into this organization; otherwise the personal vault. */
  organizationId?: OrganizationId;
  /** Folder (personal) or collection (organization) to nest the import under, if any. */
  selectedImportTarget?: FolderView | CollectionView;
  /** Cipher types disabled by policy that the importer must drop. */
  restrictedTypes: CipherType[];
}

/**
 * A vault importer whose parsing/encryption/submission is performed by the SDK. Strategies are thin
 * adapters: translate the inputs into the importer's SDK call and normalize the result.
 * `ImportService` owns the unlocked-client lifecycle and passes the taken client.
 */
export interface SdkVaultImporter {
  /** The credentials the entry points must collect before invoking {@link SdkVaultImporter.import}. */
  readonly credentialKind: CredentialKind;

  /** Optional file-picker `accept` hint (e.g. `".kdbx"`) for the file input. */
  readonly fileTypeHint?: string;

  /** Parse + encrypt + submit via the SDK, returning normalized counts. Throws on failure. */
  import(
    client: PasswordManagerClient,
    file: Uint8Array,
    credentials: SdkImportCredentials,
    context: SdkImportContext,
  ): Promise<SdkImportSummary>;

  /**
   * Maps a thrown error to a localization key, or `undefined` to surface the raw error. Lets each
   * importer own its error messaging instead of the entry points switching on error variants.
   */
  errorMessageKey?(error: unknown): string | undefined;
}
