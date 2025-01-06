import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const Mozilla: VendorMetadata = {
  id: Vendor.mozilla,
  name: "Mozilla",
};

export const MozillaExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: Mozilla,
      name: "Firefox Relay",
    },
    host: {
      authorization: "token",
      selfHost: "never",
      baseUrl: "https://relay.firefox.com/api",
    },
    requestedFields: [Field.token],
  },
];
