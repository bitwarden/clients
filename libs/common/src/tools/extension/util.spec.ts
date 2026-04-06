import { EXTENSION_DISK } from "../../platform/state";
import { PrivateClassifier } from "../private-classifier";
import { deepFreeze } from "../util";

import { Site } from "./data";
import { ExtensionMetadata, ExtensionProfileMetadata } from "./type";
import { toObjectKey } from "./util";
import { Bitwarden } from "./vendor/bitwarden";

const ExampleProfile: ExtensionProfileMetadata<object, "forwarder"> = deepFreeze({
  type: "extension",
  site: "forwarder",
  storage: {
    key: "example",
    options: {
      clearOn: [],
      deserializer: (value) => value as any,
    },
    initial: {},
    frame: 1,
  },
});

const ExampleMetadata: ExtensionMetadata = {
  site: { id: Site.forwarder, availableFields: [] },
  product: { vendor: Bitwarden },
  host: { authentication: true, selfHost: "maybe", baseUrl: "http://example.com" },
  requestedFields: [],
};

describe("toObjectKey", () => {
  it("sets static fields", () => {
    const result = toObjectKey(ExampleProfile, ExampleMetadata);

    expect(result.target).toEqual("object");
    expect(result.format).toEqual("classified");
    expect(result.state).toBe(EXTENSION_DISK);
    expect(result.classifier).toBeInstanceOf(PrivateClassifier);
  });

  it("creates a dynamic object key", () => {
    const result = toObjectKey(ExampleProfile, ExampleMetadata);

    expect(result.key).toEqual("forwarder.bitwarden.example");
  });

  it("copies the profile storage metadata", () => {
    const result = toObjectKey(ExampleProfile, ExampleMetadata);

    expect(result.frame).toEqual(ExampleProfile.storage.frame);
    expect(result.options).toBe(ExampleProfile.storage.options);
    expect(result.initial).toBe(ExampleProfile.storage.initial);
  });
});
