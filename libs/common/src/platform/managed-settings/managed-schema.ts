import { MANAGED_KEY_CATALOG, ManagedKeyDescriptor } from "./catalog";

/** A node in the Chromium managed-storage schema. */
export interface ManagedSchemaNode {
  type: "object" | "string" | "boolean" | "integer";
  description?: string;
  properties?: Record<string, ManagedSchemaNode>;
}

/**
 * Build the Chromium managed-storage schema (chrome.storage.managed) from the catalog. Dotted keys
 * become nested object properties; each leaf carries its JSON type and description. Chromium
 * validates managed values against this schema, so a key absent here cannot be set by an
 * administrator.
 */
export function buildChromiumManagedSchema(
  catalog: readonly ManagedKeyDescriptor[] = MANAGED_KEY_CATALOG,
): ManagedSchemaNode {
  const root: ManagedSchemaNode = { type: "object", properties: {} };

  for (const descriptor of catalog) {
    const segments = descriptor.key.split(".");
    let node = root;
    segments.forEach((segment, index) => {
      node.properties ??= {};
      if (index === segments.length - 1) {
        node.properties[segment] = { type: descriptor.type, description: descriptor.description };
        return;
      }
      let child = node.properties[segment];
      if (child == null) {
        child = { type: "object", properties: {} };
        node.properties[segment] = child;
      }
      node = child;
    });
  }

  return root;
}
