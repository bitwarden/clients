import { CredentialKind } from "./credential-kind";
import { SdkImporterRegistry } from "./sdk-importer-registry";
import { SdkVaultImporter } from "./sdk-vault-importer";

describe("SdkImporterRegistry", () => {
  const stubImporter = (): SdkVaultImporter => ({
    credentialKind: CredentialKind.none,
    import: jest.fn(),
  });

  it("reports unregistered formats as absent", () => {
    const registry = new SdkImporterRegistry();

    expect(registry.has("keepasskdbx")).toBe(false);
    expect(registry.get("keepasskdbx")).toBeUndefined();
  });

  it("registers and resolves an importer", () => {
    const registry = new SdkImporterRegistry();
    const importer = stubImporter();
    registry.register("keepasskdbx", () => importer);

    expect(registry.has("keepasskdbx")).toBe(true);
    expect(registry.get("keepasskdbx")).toBe(importer);
  });

  it("constructs each importer once and memoizes it across resolutions", () => {
    const registry = new SdkImporterRegistry();
    const factory = jest.fn(() => stubImporter());
    registry.register("keepasskdbx", factory);

    const first = registry.get("keepasskdbx");
    const second = registry.get("keepasskdbx");

    expect(factory).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });
});
