import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const ForwardEmail: VendorMetadata = {
  id: Vendor.forwardemail,
  name: "Forward Email",
};

export const ForwardEmailExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: ForwardEmail,
    },
    host: {
      authorization: "basic-username",
      selfHost: "never",
      baseUrl: "https://api.forwardemail.net",
    },
    requestedFields: [Field.domain, Field.token],
  },
];
