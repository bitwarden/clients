import { DefaultFields, DefaultSites, Extension } from "./metadata";
import { RuntimeExtensionRegistry } from "./runtime-extension-registry";
import { VendorExtensions, Vendors } from "./vendor";

// FIXME: find a better way to build the registry than a hard-coded factory function

/** Constructs the extension registry */
export function buildExtensionRegistry() {
  const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);

  for (const site of Reflect.ownKeys(Extension) as string[]) {
    registry.registerSite(Extension[site]);
  }

  for (const vendor of Vendors) {
    registry.registerVendor(vendor);
  }

  for (const extension of VendorExtensions) {
    registry.registerExtension(extension);
  }

  return registry;
}
