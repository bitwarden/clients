import { deepFreeze } from "../util";

import { ExtensionMetadata, SiteMetadata, VendorId } from "./type";

/** Describes the capabilities of an extension site.
 *  This type is immutable.
 */
export class ExtensionSite {
  /** instantiate the extension site
   *  @param site describes the extension site
   *  @param vendors describes the available vendors
   *  @param extensions describes the available extensions
   */
  constructor(
    readonly site: Readonly<SiteMetadata>,
    readonly extensions: ReadonlyMap<VendorId, Readonly<ExtensionMetadata>>,
  ) {
    deepFreeze(this);
  }
}
