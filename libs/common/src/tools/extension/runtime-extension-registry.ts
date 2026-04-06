import { deepFreeze } from "../util";

import { ExtensionRegistry } from "./extension-registry.abstraction";
import { ExtensionSite } from "./extension-site";
import { AllowedPermissions } from "./metadata";
import {
  ExtensionMetadata,
  ExtensionPermission,
  ExtensionSet,
  FieldId,
  ProductMetadata,
  SiteMetadata,
  SiteId,
  VendorId,
  VendorMetadata,
} from "./type";

/** Tracks extension sites and the vendors that extend them in application memory. */
export class RuntimeExtensionRegistry implements ExtensionRegistry {
  /** Instantiates the extension registry
   *  @param allowedSites sites that are valid for use by any extension;
   *    this is most useful to disable an extension site that is only
   *    available on a specific client.
   *  @param allowedFields fields that are valid for use by any extension;
   *    this is most useful to prohibit access to a field via policy.
   */
  constructor(
    private readonly allowedSites: SiteId[],
    private readonly allowedFields: FieldId[],
  ) {
    Object.freeze(this.allowedFields);
    Object.freeze(this.allowedSites);
  }

  private allPermission: ExtensionPermission = "default";

  private siteRegistrations = new Map<SiteId, SiteMetadata>();
  private sitePermissions = new Map<SiteId, ExtensionPermission>();

  private vendorRegistrations = new Map<VendorId, VendorMetadata>();
  private vendorPermissions = new Map<VendorId, ExtensionPermission>();

  private extensionRegistrations = new Array<ExtensionMetadata>();
  private extensionsBySiteByVendor = new Map<SiteId, Map<VendorId, number>>();

  registerSite(site: SiteMetadata): this {
    if (!this.allowedSites.includes(site.id)) {
      return this;
    }

    // verify requested fields are on the list of valid fields to expose to
    // an extension
    const availableFields = site.availableFields.filter((field) =>
      this.allowedFields.includes(field),
    );
    const validated: SiteMetadata = deepFreeze({ id: site.id, availableFields });

    if (!this.siteRegistrations.has(site.id)) {
      this.siteRegistrations.set(site.id, validated);
    }

    return this;
  }

  site(site: SiteId): SiteMetadata | undefined {
    const result = this.siteRegistrations.get(site);
    return result;
  }

  sites() {
    const sites: { site: SiteMetadata; permission?: ExtensionPermission }[] = [];

    for (const [k, site] of this.siteRegistrations.entries()) {
      const s: (typeof sites)[number] = { site };
      const permission = this.sitePermissions.get(k);
      if (permission) {
        s.permission = permission;
      }

      sites.push(s);
    }

    return sites;
  }

  registerVendor(vendor: VendorMetadata): this {
    if (!this.vendorRegistrations.has(vendor.id)) {
      const frozen = deepFreeze(vendor);
      this.vendorRegistrations.set(vendor.id, frozen);
    }

    return this;
  }

  vendor(vendor: VendorId): VendorMetadata | undefined {
    const result = this.vendorRegistrations.get(vendor);
    return result;
  }

  vendors() {
    const vendors: { vendor: VendorMetadata; permission?: ExtensionPermission }[] = [];

    for (const [k, vendor] of this.vendorRegistrations.entries()) {
      const s: (typeof vendors)[number] = { vendor };
      const permission = this.vendorPermissions.get(k);
      if (permission) {
        s.permission = permission;
      }

      vendors.push(s);
    }

    return vendors;
  }

  setPermission(set: ExtensionSet, permission: ExtensionPermission): this {
    if (!AllowedPermissions.includes(permission)) {
      throw new Error(`invalid extension permission: ${permission}`);
    }

    if ("all" in set && set.all) {
      this.allPermission = permission;
    } else if ("vendor" in set) {
      this.vendorPermissions.set(set.vendor, permission);
    } else if ("site" in set) {
      if (this.allowedSites.includes(set.site)) {
        this.sitePermissions.set(set.site, permission);
      }
    } else {
      throw new Error(`Unrecognized extension set received: ${JSON.stringify(set)}.`);
    }

    return this;
  }

  permission(set: ExtensionSet) {
    if ("all" in set && set.all) {
      return this.allPermission;
    } else if ("vendor" in set) {
      return this.vendorPermissions.get(set.vendor);
    } else if ("site" in set) {
      return this.sitePermissions.get(set.site);
    } else {
      return undefined;
    }
  }

  permissions() {
    const rules: { set: ExtensionSet; permission: ExtensionPermission }[] = [];
    rules.push({ set: { all: true }, permission: this.allPermission });

    for (const [site, permission] of this.sitePermissions.entries()) {
      rules.push({ set: { site }, permission });
    }

    for (const [vendor, permission] of this.vendorPermissions.entries()) {
      rules.push({ set: { vendor }, permission });
    }

    return rules;
  }

  registerExtension(meta: ExtensionMetadata): this {
    const site = this.siteRegistrations.get(meta.site.id);
    const vendor = this.vendorRegistrations.get(meta.product.vendor.id);
    if (!site || !vendor) {
      return this;
    }

    // exit early if the extension is already registered
    const extensionsByVendor =
      this.extensionsBySiteByVendor.get(meta.site.id) ?? new Map<VendorId, number>();
    if (extensionsByVendor.has(meta.product.vendor.id)) {
      return this;
    }

    // create immutable copy; this updates the vendor and site with
    // their internalized representation to provide reference equality
    // across registrations
    const product: ProductMetadata = { vendor };
    if (meta.product.name) {
      product.name = meta.product.name;
    }
    const extension: ExtensionMetadata = Object.freeze({
      site,
      product: Object.freeze(product),
      host: Object.freeze({ ...meta.host }),
      requestedFields: Object.freeze([...meta.requestedFields]),
    });

    // register it
    const index = this.extensionRegistrations.push(extension) - 1;
    extensionsByVendor.set(vendor.id, index);
    this.extensionsBySiteByVendor.set(site.id, extensionsByVendor);

    return this;
  }

  extension(site: SiteId, vendor: VendorId): ExtensionMetadata | undefined {
    const index = this.extensionsBySiteByVendor.get(site)?.get(vendor) ?? -1;
    if (index < 0) {
      return undefined;
    } else {
      return this.extensionRegistrations[index];
    }
  }

  private getPermissions(site: SiteId, vendor: VendorId): ExtensionPermission[] {
    const permissions = [
      this.sitePermissions.get(site),
      this.vendorPermissions.get(vendor),
      this.allPermission,
      // Need to cast away `undefined` because typescript isn't
      // aware that the filter eliminates undefined elements
    ].filter((p) => !!p) as ExtensionPermission[];

    return permissions;
  }

  extensions(): ReadonlyArray<{
    extension: ExtensionMetadata;
    permissions: ExtensionPermission[];
  }> {
    const extensions = [];
    for (const extension of this.extensionRegistrations) {
      const permissions = this.getPermissions(extension.site.id, extension.product.vendor.id);

      extensions.push({ extension, permissions });
    }

    return extensions;
  }

  build(id: SiteId): ExtensionSite | undefined {
    const site = this.siteRegistrations.get(id);
    if (!site) {
      return undefined;
    }

    if (this.allPermission === "deny") {
      return new ExtensionSite(site, new Map());
    }

    const extensions = new Map<VendorId, ExtensionMetadata>();
    const entries = this.extensionsBySiteByVendor.get(id)?.entries() ?? ([] as const);
    for (const [vendor, index] of entries) {
      const permissions = this.getPermissions(id, vendor);

      const extension = evaluate(permissions, this.extensionRegistrations[index]);
      if (extension) {
        extensions.set(vendor, extension);
      }
    }

    const extensionSite = new ExtensionSite(site, extensions);
    return extensionSite;
  }
}

function evaluate(
  permissions: ExtensionPermission[],
  value: ExtensionMetadata,
): ExtensionMetadata | undefined {
  // deny always wins
  if (permissions.includes("deny")) {
    return undefined;
  }

  // allow overrides implicit permissions
  if (permissions.includes("allow")) {
    return value;
  }

  // none permission becomes a deny
  if (permissions.includes("none")) {
    return undefined;
  }

  // default permission becomes an allow
  if (permissions.includes("default")) {
    return value;
  }

  // if no permission is recognized, throw. This code is unreachable.
  throw new Error("failed to recognize any permissions");
}
