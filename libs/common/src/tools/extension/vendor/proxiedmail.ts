import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const ProxiedMail: VendorMetadata = {
  id: Vendor.proxiedmail,
  name: "ProxiedMail",
};

export const ProxiedMailExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: ProxiedMail,
    },
    host: {
      authorization: "bearer",
      selfHost: "no",
      baseUrl: "https://proxiedmail.com",
    },
    requestedFields: [Field.token, Field.domain],
  },
];
