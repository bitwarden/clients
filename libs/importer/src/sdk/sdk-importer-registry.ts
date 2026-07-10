import { ImportType } from "../models/import-options";

import { SdkVaultImporter } from "./sdk-vault-importer";

/**
 * Maps an import format to its SDK-backed importer strategy. Formats absent from the registry use
 * the classic client-side `Importer` pipeline. Each strategy is constructed lazily on first lookup
 * and memoized, since `get` can be hit per change-detection cycle (e.g. via `acceptedFileTypes`).
 */
export class SdkImporterRegistry {
  private readonly factories = new Map<ImportType, () => SdkVaultImporter>();
  private readonly instances = new Map<ImportType, SdkVaultImporter>();

  register(format: ImportType, factory: () => SdkVaultImporter): void {
    this.factories.set(format, factory);
  }

  has(format: ImportType): boolean {
    return this.factories.has(format);
  }

  get(format: ImportType): SdkVaultImporter | undefined {
    const existing = this.instances.get(format);
    if (existing != null) {
      return existing;
    }
    const instance = this.factories.get(format)?.();
    if (instance != null) {
      this.instances.set(format, instance);
    }
    return instance;
  }
}
