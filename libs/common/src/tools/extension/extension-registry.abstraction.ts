import { ExtensionSite } from "./extension-site";
import {
  ExtensionMetadata,
  ExtensionSet,
  ExtensionPermission,
  SiteId,
  SiteMetadata,
  VendorId,
  VendorMetadata,
} from "./type";

/** Tracks extension sites and the vendors that extend them. */
export abstract class ExtensionRegistry {
  /** Registers a site supporting extensibility.
   *  Each site may only be registered once. Calls after the first for
   *  the same SiteId have no effect.
   *  @param site identifies the site being extended
   *  @param meta configures the extension site
   *  @return self for method chaining.
   *  @remarks The registry initializes with a set of allowed sites and fields.
   *  `registerSite` drops a registration and trims its allowed fields to only
   *  those indicated in the allow list.
   */
  abstract registerSite: (meta: SiteMetadata) => this;

  /** List all registered extension sites with their extension permission, if any.
   *  @returns a list of all extension sites. `permission` is defined when the site
   *    is associated with an extension permission.
   */
  abstract sites: () => { site: SiteMetadata; permission?: ExtensionPermission }[];

  /** Get a site's metadata
   *  @param site identifies a site registration
   *  @return the site's metadata or `undefined` if the site isn't registered.
   */
  abstract site: (site: SiteId) => SiteMetadata | undefined;

  /** Registers a vendor providing an extension.
   *  Each vendor may only be registered once. Calls after the first for
   *  the same VendorId have no effect.
   *  @param site - identifies the site being extended
   *  @param meta - configures the extension site
   *  @return self for method chaining.
   */
  abstract registerVendor: (meta: VendorMetadata) => this;

  /** List all registered vendors with their permissions, if any.
   *  @returns a list of all extension sites. `permission` is defined when the site
   *    is associated with an extension permission.
   */
  abstract vendors: () => { vendor: VendorMetadata; permission?: ExtensionPermission }[];

  /** Get a vendor's metadata
   *  @param site identifies a vendor registration
   *  @return the vendor's metadata or `undefined` if the vendor isn't registered.
   */
  abstract vendor: (vendor: VendorId) => VendorMetadata | undefined;

  /** Registers an extension provided by a vendor to an extension site.
   *  The vendor and site MUST be registered before the extension.
   *  Each extension may only be registered once. Calls after the first for
   *  the same SiteId and VendorId have no effect.
   *  @param site - identifies the site being extended
   *  @param meta - configures the extension site
   *  @return self for method chaining.
   */
  abstract registerExtension: (meta: ExtensionMetadata) => this;

  /** Get an extensions metadata
   *  @param site identifies the extension's site
   *  @param vendor identifies the extension's vendor
   *  @return the extension's metadata or `undefined` if the extension isn't registered.
   */
  abstract extension: (site: SiteId, vendor: VendorId) => ExtensionMetadata | undefined;

  /** List all registered extensions and their permissions */
  abstract extensions: () => ReadonlyArray<{
    extension: ExtensionMetadata;
    permissions: ExtensionPermission[];
  }>;

  /** Registers a permission. Only 1 permission can be registered for each extension set.
   *  Calls after the first *replace* the registered permission.
   *  @param set the collection of extensions affected by the permission
   *  @param permission the permission for the collection
   *  @return self for method chaining.
   */
  abstract setPermission: (set: ExtensionSet, permission: ExtensionPermission) => this;

  /** Retrieves the current permission for the given extension set or `undefined` if
   *  a permission doesn't exist.
   */
  abstract permission: (set: ExtensionSet) => ExtensionPermission | undefined;

  /** Returns all registered extension rules. */
  abstract permissions: () => { set: ExtensionSet; permission: ExtensionPermission }[];

  /** Creates a point-in-time snapshot of the registry's contents with extension
   *  permissions applied for the provided SiteId.
   *  @param id identifies the extension site to create.
   *  @returns the extension site, or `undefined` if the site is not registered.
   */
  abstract build: (id: SiteId) => ExtensionSite | undefined;
}
