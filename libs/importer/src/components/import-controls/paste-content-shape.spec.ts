import {
  detectPasteContentShape,
  expectedPasteShapeFor,
  vendorSupportsPasteShapeNarrowing,
} from "./paste-content-shape";

describe("detectPasteContentShape", () => {
  it("detects a json object", () => {
    expect(detectPasteContentShape('{"foo":"bar"}')).toBe("json");
  });

  it("detects a json array", () => {
    expect(detectPasteContentShape('[{"foo":"bar"}]')).toBe("json");
  });

  it("detects json past leading whitespace", () => {
    expect(detectPasteContentShape('  \n {"foo":"bar"}')).toBe("json");
  });

  it("detects xml", () => {
    expect(detectPasteContentShape('<?xml version="1.0"?><root></root>')).toBe("xml");
  });

  it("falls back to csv for anything else", () => {
    expect(detectPasteContentShape("url,username,password\nhttps://example.com,me,hunter2")).toBe(
      "csv",
    );
  });
});

describe("expectedPasteShapeFor", () => {
  it("classifies every format in the six shape-narrowable vendor groups", () => {
    expect(expectedPasteShapeFor("bitwardenjson")).toBe("json");
    expect(expectedPasteShapeFor("bitwardencsv")).toBe("csv");
    expect(expectedPasteShapeFor("dashlanejson")).toBe("json");
    expect(expectedPasteShapeFor("dashlanecsv")).toBe("csv");
    expect(expectedPasteShapeFor("keeperjson")).toBe("json");
    expect(expectedPasteShapeFor("keepercsv")).toBe("csv");
    expect(expectedPasteShapeFor("enpassjson")).toBe("json");
    expect(expectedPasteShapeFor("enpasscsv")).toBe("csv");
    expect(expectedPasteShapeFor("avastjson")).toBe("json");
    expect(expectedPasteShapeFor("avastcsv")).toBe("csv");
    expect(expectedPasteShapeFor("delineaxml")).toBe("xml");
    expect(expectedPasteShapeFor("delineacsv")).toBe("csv");
  });

  it("leaves 1Password's formats unclassified", () => {
    expect(expectedPasteShapeFor("1password1pux")).toBeUndefined();
    expect(expectedPasteShapeFor("1password1pif")).toBeUndefined();
    expect(expectedPasteShapeFor("1passwordwincsv")).toBeUndefined();
    expect(expectedPasteShapeFor("1passwordmaccsv")).toBeUndefined();
  });
});

describe("vendorSupportsPasteShapeNarrowing", () => {
  it("is true for exactly the six target vendors", () => {
    expect(vendorSupportsPasteShapeNarrowing("bitwardenjson")).toBe(true);
    expect(vendorSupportsPasteShapeNarrowing("dashlanecsv")).toBe(true);
    expect(vendorSupportsPasteShapeNarrowing("keeper")).toBe(true);
    expect(vendorSupportsPasteShapeNarrowing("enpasscsv")).toBe(true);
    expect(vendorSupportsPasteShapeNarrowing("avastcsv")).toBe(true);
    expect(vendorSupportsPasteShapeNarrowing("delineaxml")).toBe(true);
  });

  it("is false for 1Password, even though its group also has a paste-format collision", () => {
    expect(vendorSupportsPasteShapeNarrowing("1password1pux")).toBe(false);
  });

  it("is false for a vendor with no collision at all", () => {
    expect(vendorSupportsPasteShapeNarrowing("lastpasscsv")).toBe(false);
  });
});
