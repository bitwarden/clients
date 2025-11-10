import { guidToRawFormat, guidToStandardFormat } from "./guid-utils";

const workingExamples: [string, Uint8Array][] = [
  [
    "00000000-0000-0000-0000-000000000000",
    new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00,
    ]),
  ],
  [
    "08d70b74-e9f5-4522-a425-e5dcd40107e7",
    new Uint8Array([
      0x08, 0xd7, 0x0b, 0x74, 0xe9, 0xf5, 0x45, 0x22, 0xa4, 0x25, 0xe5, 0xdc, 0xd4, 0x01, 0x07,
      0xe7,
    ]),
  ],
];

describe("guid-utils", () => {
  describe("guidToRawFormat", () => {
    it.each(workingExamples)(
      "returns UUID in binary format when given a valid UUID string",
      (input, expected) => {
        const result = guidToRawFormat(input);

        expect(result).toEqual(expected);
      },
    );

    it.each([
      "invalid",
      "",
      "",
      "00000000-0000-0000-0000-0000000000000000",
      "00000000-0000-0000-0000-000000",
    ])("throws an error when given an invalid UUID string", (input) => {
      expect(() => guidToRawFormat(input)).toThrow(TypeError);
    });
  });

  describe("guidToStandardFormat", () => {
    it.each(workingExamples)(
      "returns UUID in standard format when given a valid UUID array buffer",
      (expected, input) => {
        const result = guidToStandardFormat(input);

        expect(result).toEqual(expected);
      },
    );

    it.each([
      new Uint8Array(),
      new Uint8Array([]),
      new Uint8Array([
        0x08, 0xd7, 0x0b, 0x74, 0xe9, 0xf5, 0x45, 0x22, 0xa4, 0x25, 0xe5, 0xdc, 0xd4, 0x01, 0x07,
        0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7, 0xe7,
      ]),
    ])("throws an error when given an invalid UUID array buffer", (input) => {
      expect(() => guidToStandardFormat(input)).toThrow(TypeError);
    });
  });
});
