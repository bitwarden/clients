import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ImportOptions, PasswordManagerClient, isImportError } from "@bitwarden/sdk-internal";

import { CredentialKind } from "../credential-kind";
import { toSdkCipherType } from "../sdk-cipher-type";
import { SdkImportCredentials } from "../sdk-import-credentials";
import { SdkImportSummary } from "../sdk-import-summary";
import { resolveSdkImportTargets } from "../sdk-import-target";
import { SdkImportContext, SdkVaultImporter } from "../sdk-vault-importer";

/** KeePass KDBX (`.kdbx`) import, parsed/encrypted/submitted by the SDK. */
export class KdbxSdkImporter implements SdkVaultImporter {
  readonly credentialKind = CredentialKind.passwordWithKeyFile;
  readonly fileTypeHint = ".kdbx";

  async import(
    client: PasswordManagerClient,
    file: Uint8Array,
    credentials: SdkImportCredentials,
    context: SdkImportContext,
  ): Promise<SdkImportSummary> {
    if (credentials.kind !== "passwordWithKeyFile") {
      throw new Error("KeePass import requires a password and optional key file.");
    }

    const { folder, collection } = resolveSdkImportTargets(context);
    const options: ImportOptions = {
      organization_id: context.organizationId ? asUuid(context.organizationId) : undefined,
      target_folder: folder ? { id: asUuid(folder.id), name: folder.name } : undefined,
      target_collection: collection
        ? { id: asUuid(collection.id), name: collection.name }
        : undefined,
      restricted_types: context.restrictedTypes.map(toSdkCipherType),
    };

    return await client
      .importers()
      .import_kdbx(file, credentials.password, credentials.keyFile ?? undefined, options);
  }

  errorMessageKey(error: unknown): string | undefined {
    if (!isImportError(error)) {
      return undefined;
    }
    switch (error.variant) {
      case "KdbxWrongCredentials":
        return "invalidFilePassword";
      case "KdbxInvalidFormat":
        return "kdbxWrongFileType";
      case "KdbxCorruptOrUnsupported":
        return "kdbxCorruptOrOutdated";
      case "KdbxFileTooLarge":
        return "kdbxFileTooLarge";
      default:
        return undefined;
    }
  }
}
