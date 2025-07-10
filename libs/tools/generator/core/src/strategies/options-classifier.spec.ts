import { IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";

import { OptionsClassifier } from "./options-classifier";

type SomeSettings = { foo: string };
type SomeOptions = IntegrationRequest & SomeSettings;

describe("OptionsClassifier", () => {
  describe("classify", () => {
    it("classifies properties from its input to the secret", () => {
      const classifier = new OptionsClassifier<SomeSettings, SomeOptions>();

      const result = classifier.classify({ foo: "bar", website: null });

      expect(result.secret).toMatchObject({ foo: "bar" });
    });

    it("omits the website property from the secret", () => {
      const classifier = new OptionsClassifier<SomeSettings, SomeOptions>();

      const result = classifier.classify({ foo: "bar", website: "www.example.com" });

      expect(result.secret).not.toHaveProperty("website");
    });

    it("has no disclosed data", () => {
      const classifier = new OptionsClassifier<SomeSettings, SomeOptions>();

      const result = classifier.classify({ foo: "bar", website: "www.example.com" });

      expect(result.disclosed).toEqual({});
    });
  });

  describe("declassify", () => {
    it("copies properties from secret to its output", () => {
      const classifier = new OptionsClassifier<SomeSettings, SomeOptions>();

      const result = classifier.declassify(null, { foo: "bar" });

      expect(result).toMatchObject({ foo: "bar" });
    });

    it("adds a website property to its output", () => {
      const classifier = new OptionsClassifier<SomeSettings, SomeOptions>();

      const result = classifier.declassify(null, { foo: "bar" });

      expect(result).toMatchObject({ website: null });
    });

    it("ignores disclosed data", () => {
      const classifier = new OptionsClassifier<SomeSettings, SomeOptions>();

      const result = classifier.declassify({ foo: "biz" }, { foo: "bar" });

      expect(result).toEqual({ foo: "bar", website: null });
    });
  });
});
