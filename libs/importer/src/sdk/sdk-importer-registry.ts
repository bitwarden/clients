import { ImportType } from "../models/import-options";

import { SdkVaultImporter } from "./sdk-vault-importer";

/**
 * Maps an import format to its SDK-backed importer strategy. Formats absent from the registry use
 * the classic client-side `Importer` pipeline. Strategies are constructed per lookup (they're cheap
 * and stateless).
 */
export class SdkImporterRegistry {
  private readonly factories = new Map<ImportType, () => SdkVaultImporter>();

  register(format: ImportType, factory: () => SdkVaultImporter): void {
    this.factories.set(format, factory);
  }

  has(format: ImportType): boolean {
    return this.factories.has(format);
  }

  get(format: ImportType): SdkVaultImporter | undefined {
    return this.factories.get(format)?.();
  }
}
