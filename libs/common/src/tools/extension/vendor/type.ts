import { Vendor } from "./data";

/** Identifies a vendor extending bitwarden */
export type VendorId = keyof typeof Vendor;

/** The capabilities and descriptive content for an extension */
export type VendorMetadata = {
  /** Uniquely identifies the vendor. */
  id: VendorId;

  /** Brand name of the service providing the extension. */
  name: string;
};
