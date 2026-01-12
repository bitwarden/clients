import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const DuckDuckGo: VendorMetadata = {
  id: Vendor.duckduckgo,
  name: "DuckDuckGo",
};

export const DuckDuckGoExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: DuckDuckGo,
    },
    host: {
      authorization: "bearer",
      selfHost: "never",
      baseUrl: "https://quack.duckduckgo.com/api",
    },
    requestedFields: [Field.token],
  },
];
