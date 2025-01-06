import { Field } from "../data";
import { Extension } from "../metadata";
import { ExtensionMetadata } from "../type";

import { Vendor } from "./data";
import { VendorMetadata } from "./type";

export const AddyIo: VendorMetadata = {
  id: Vendor.addyio,
  name: "Addy.io",
};

export const AddyIoExtensions: ExtensionMetadata[] = [
  {
    site: Extension.forwarder,
    product: {
      vendor: AddyIo,
    },
    host: {
      authorization: "bearer",
      selfHost: "maybe",
      baseUrl: "https://app.addy.io",
    },
    requestedFields: [Field.token, Field.baseUrl, Field.domain],
  },
];
