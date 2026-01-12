import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const SimpleLogin: VendorMetadata = {
  id: Vendor.simplelogin,
  name: "SimpleLogin",
};

export const SimpleLoginExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: SimpleLogin,
    },
    host: {
      authentication: true,
      selfHost: "maybe",
      baseUrl: "https://app.simplelogin.io",
    },
    requestedFields: [Field.baseUrl, Field.token, Field.domain],
  },
];
