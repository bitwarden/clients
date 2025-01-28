import { Opaque } from "type-fest";

import { Site, Field, Permission } from "./data";

/** well-known name for a feature extensible through an extension. */
export type SiteId = keyof typeof Site;

/** well-known name for a field surfaced from an extension site to a vendor. */
export type FieldId = keyof typeof Field;

/** Identifies a vendor extending bitwarden */
export type VendorId = Opaque<"vendor", string>;

/** uniquely identifies an extension. */
export type ExtensionId = { site: SiteId; vendor: VendorId };

/** Permission levels for metadata. */
export type ExtensionPermission = keyof typeof Permission;

/** The capabilities and descriptive content for an extension */
export type SiteMetadata = {
  /** Uniquely identifies the extension site. */
  id: SiteId;

  /** Lists the fields disclosed by the extension to the vendor */
  availableFields: FieldId[];
};

/** The capabilities and descriptive content for an extension */
export type VendorMetadata = {
  /** Uniquely identifies the vendor. */
  id: VendorId;

  /** Brand name of the service providing the extension. */
  name: string;
};

type TokenHeader =
  | {
      /** Transmit the token as the value of an `Authentication` header */
      authentication: true;
    }
  | {
      /** Transmit the token as an `Authorization` header and a formatted value
       *  * `bearer` uses OAUTH-2.0 bearer token format
       *  * `token` prefixes the token with "Token"
       *  * `basic-username` uses HTTP Basic authentication format, encoding the
       *     token as the username.
       */
      authorization: "bearer" | "token" | "basic-username";
    };

/** Catalogues an extension's hosting status.
 *  selfHost: "never" always uses the service's base URL
 *  selfHost: "maybe" allows the user to override the service's
 *    base URL with their own.
 *  selfHost: "always" requires a base URL.
 */
export type ApiHost = TokenHeader &
  (
    | { selfHost: "never"; baseUrl: string }
    | { selfHost: "maybe"; baseUrl: string }
    | { selfHost: "always" }
  );

/** Describes a branded product */
export type ProductMetadata = {
  /** The vendor providing the extension */
  vendor: VendorMetadata;

  /** The branded name of the product, if it varies from the Vendor name */
  name?: string;
};

/** Describes an extension provided by a vendor */
export type ExtensionMetadata = {
  /** The part of Bitwarden extended by the vendor's services */
  readonly site: Readonly<SiteMetadata>;

  /** Product description */
  readonly product: Readonly<ProductMetadata>;

  /** Hosting provider capabilities required by the extension  */
  readonly host: Readonly<ApiHost>;

  /** Lists the fields disclosed by the extension to the vendor.
   *  This should be a subset of the `availableFields` listed in
   *  the extension.
   */
  readonly requestedFields: ReadonlyArray<Readonly<FieldId>>;
};

/** Identifies a collection of extensions.
 */
export type ExtensionSet =
  | {
      /** A set of extensions sharing an extension point */
      site: SiteId;
    }
  | {
      /** A set of extensions sharing a vendor */
      vendor: VendorId;
    }
  | {
      /** The total set of extensions. This is used to set a categorical
       *  rule affecting all extensions.
       */
      all: true;
    };
