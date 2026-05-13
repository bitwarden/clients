import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const MailFlusher: VendorMetadata = {
  id: Vendor.mailflusher,
  name: "MailFlusher",
};

export const MailFlusherExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: MailFlusher,
    },
    host: {
      authorization: "bearer",
      selfHost: "never",
      baseUrl: "https://app.mailflusher.com",
    },
    requestedFields: [Field.token, Field.domain],
  },
];
