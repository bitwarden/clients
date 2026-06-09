import { KdbxSdkImporter } from "./importers/kdbx-sdk-importer";
import { SdkImporterRegistry } from "./sdk-importer-registry";

/**
 * Builds the registry of SDK-backed importers. This is the single place a new SDK importer is
 * registered — adding one here (plus its strategy class) requires no changes to the import entry
 * points or `ImportService` orchestration.
 */
export function buildSdkImporterRegistry(): SdkImporterRegistry {
  const registry = new SdkImporterRegistry();
  registry.register("keepasskdbx", () => new KdbxSdkImporter());
  return registry;
}
