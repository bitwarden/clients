import { SecretClassifier } from "./secret-classifier";

describe("SecretClassifier", () => {
  describe("forSecret", () => {
    it("classifies a property as secret by default", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean }>();

      expect(classifier.disclosed).toEqual([]);
      expect(classifier.excluded).toEqual([]);
    });
  });

  describe("disclose", () => {
    it("adds a property to the disclosed list", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean }>();

      const withDisclosedFoo = classifier.disclose("foo");

      expect(withDisclosedFoo.disclosed).toEqual(["foo"]);
      expect(withDisclosedFoo.excluded).toEqual([]);
    });

    it("chains calls with excluded", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>();

      const withDisclosedFoo = classifier.disclose("foo").exclude("bar");

      expect(withDisclosedFoo.disclosed).toEqual(["foo"]);
      expect(withDisclosedFoo.excluded).toEqual(["bar"]);
    });

    it("returns a new classifier", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean }>();

      const withDisclosedFoo = classifier.disclose("foo");

      expect(withDisclosedFoo).not.toBe(classifier);
    });
  });

  describe("exclude", () => {
    it("adds a property to the excluded list", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean }>();

      const withExcludedFoo = classifier.exclude("foo");

      expect(withExcludedFoo.disclosed).toEqual([]);
      expect(withExcludedFoo.excluded).toEqual(["foo"]);
    });

    it("chains calls with disclose", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>();

      const withExcludedFoo = classifier.exclude("foo").disclose("bar");

      expect(withExcludedFoo.disclosed).toEqual(["bar"]);
      expect(withExcludedFoo.excluded).toEqual(["foo"]);
    });

    it("returns a new classifier", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean }>();

      const withExcludedFoo = classifier.exclude("foo");

      expect(withExcludedFoo).not.toBe(classifier);
    });
  });

  describe("classify", () => {
    it("partitions disclosed properties into the disclosed member", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>().disclose(
        "foo",
      );

      const classified = classifier.classify({ foo: true, bar: false });

      expect(classified.disclosed).toEqual({ foo: true });
    });

    it("jsonifies its outputs", () => {
      const classifier = SecretClassifier.allSecret<{ foo: Date; bar: Date }>().disclose("foo");

      const classified = classifier.classify({ foo: new Date(100), bar: new Date(100) });

      expect(classified.disclosed).toEqual({ foo: "1970-01-01T00:00:00.100Z" });
      expect(classified.secret).toEqual({ bar: "1970-01-01T00:00:00.100Z" });
    });

    it("deletes disclosed properties from the secret member", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>().disclose(
        "foo",
      );

      const classified = classifier.classify({ foo: true, bar: false });

      expect(classified.secret).toEqual({ bar: false });
    });

    it("deletes excluded properties from the secret member", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>().exclude(
        "foo",
      );

      const classified = classifier.classify({ foo: true, bar: false });

      expect(classified.secret).toEqual({ bar: false });
    });

    it("excludes excluded properties from the disclosed member", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>().exclude(
        "foo",
      );

      const classified = classifier.classify({ foo: true, bar: false });

      expect(classified.disclosed).toEqual({});
    });
  });

  describe("declassify", () => {
    it("merges disclosed and secret members", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>().disclose(
        "foo",
      );

      const declassified = classifier.declassify({ foo: true }, { bar: false });

      expect(declassified).toEqual({ foo: true, bar: false });
    });

    it("omits unknown disclosed members", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean }>().disclose("foo");

      // `any` is required here because Typescript knows `bar` is not a disclosed member,
      // but the feautre assumes the disclosed data bypassed the typechecker (e.g. someone
      // is trying to clobber secret data.)
      const declassified = classifier.declassify({ foo: true, bar: false } as any, {});

      expect(declassified).toEqual({ foo: true });
    });

    it("clobbers disclosed members with secret members", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>().disclose(
        "foo",
      );

      // `any` is required here because `declassify` knows `bar` is supposed to be public,
      // but the feature assumes the secret data bypassed the typechecker (e.g. migrated data)
      const declassified = classifier.declassify({ foo: true }, { foo: false, bar: false } as any);

      expect(declassified).toEqual({ foo: false, bar: false });
    });

    it("omits excluded secret members", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean; bar: boolean }>().exclude(
        "foo",
      );

      // `any` is required here because `declassify` knows `bar` isn't allowed, but the
      // feature assumes the data bypassed the typechecker (e.g. omitted legacy data).
      const declassified = classifier.declassify({}, { foo: false, bar: false } as any);

      expect(declassified).toEqual({ bar: false });
    });

    it("returns a new object", () => {
      const classifier = SecretClassifier.allSecret<{ foo: boolean }>();

      const disclosed = {};
      const secret = { foo: false };
      const declassified = classifier.declassify(disclosed, secret);

      expect(declassified).not.toBe(disclosed);
      expect(declassified).not.toBe(secret);
    });
  });
});
