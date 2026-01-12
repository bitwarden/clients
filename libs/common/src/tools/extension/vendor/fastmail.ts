import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const Fastmail: VendorMetadata = {
  id: Vendor.fastmail,
  name: "Fastmail",
};

export const FastmailExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: Fastmail,
    },
    host: {
      authorization: "bearer",
      selfHost: "maybe",
      baseUrl: "https://api.fastmail.com",
    },
    requestedFields: [Field.token],
  },
];
