import { ImportOption } from "../../models";
import { importOptions } from "../../models/import-options";

import {
  detectPasteContentShape,
  expectedPasteShapeFor,
  vendorSupportsPasteShapeNarrowing,
} from "./paste-content-shape";

function optionWithPasteFormats(pasteFormats: readonly string[]): ImportOption {
  return { ...importOptions[0], pasteFormats };
}

function realOption(id: string): ImportOption {
  const option = importOptions.find((o) => o.id === id);
  if (option == null) {
    throw new Error(`No real ImportOption for id: ${id}`);
  }
  return option;
}

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
  it("classifies every real format in the six shape-narrowable vendor groups, read off pasteFormats", () => {
    expect(expectedPasteShapeFor(realOption("bitwardenjson"))).toBe("json");
    expect(expectedPasteShapeFor(realOption("bitwardencsv"))).toBe("csv");
    expect(expectedPasteShapeFor(realOption("dashlanejson"))).toBe("json");
    expect(expectedPasteShapeFor(realOption("dashlanecsv"))).toBe("csv");
    expect(expectedPasteShapeFor(realOption("keeperjson"))).toBe("json");
    expect(expectedPasteShapeFor(realOption("keepercsv"))).toBe("csv");
    expect(expectedPasteShapeFor(realOption("enpassjson"))).toBe("json");
    expect(expectedPasteShapeFor(realOption("enpasscsv"))).toBe("csv");
    expect(expectedPasteShapeFor(realOption("avastjson"))).toBe("json");
    expect(expectedPasteShapeFor(realOption("avastcsv"))).toBe("csv");
    expect(expectedPasteShapeFor(realOption("delineaxml"))).toBe("xml");
    expect(expectedPasteShapeFor(realOption("delineacsv"))).toBe("csv");
  });

  it("leaves 1Password's real formats unclassified", () => {
    expect(expectedPasteShapeFor(realOption("1password1pux"))).toBe("json");
    expect(expectedPasteShapeFor(realOption("1password1pif"))).toBeUndefined();
    expect(expectedPasteShapeFor(realOption("1passwordwincsv"))).toBe("csv");
    expect(expectedPasteShapeFor(realOption("1passwordmaccsv"))).toBe("csv");
  });

  it("is undefined for a format with no known shape (drift guard)", () => {
    expect(expectedPasteShapeFor(optionWithPasteFormats(["1pif"]))).toBeUndefined();
    expect(expectedPasteShapeFor(optionWithPasteFormats(["kdbx"]))).toBeUndefined();
  });

  it("is undefined for a format pasteable as more than one shape (drift guard)", () => {
    expect(expectedPasteShapeFor(optionWithPasteFormats(["json", "csv"]))).toBeUndefined();
  });

  it("is undefined for a format with no paste formats at all", () => {
    expect(expectedPasteShapeFor(optionWithPasteFormats([]))).toBeUndefined();
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
