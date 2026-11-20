import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata, VendorMetadata } from "../type";

import { Vendor } from "./data";

export const Skudo: VendorMetadata = {
  id: Vendor.skudo,
  name: "Skudo",
};

export const SkudoExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: Skudo,
    },
    host: {
      authorization: "bearer",
      selfHost: "maybe",
      baseUrl: "https://app.skudo.org",
    },
    requestedFields: [Field.token, Field.baseUrl, Field.domain],
  },
];
