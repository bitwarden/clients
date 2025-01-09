import { guidToRawFormat } from "./guid-utils";

describe("guid-utils", () => {
  describe("guidToRawFormat", () => {
    it.each([
      [
        "00000000-0000-0000-0000-000000000000",
        [
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00,
        ],
        "08d70b74-e9f5-4522-a425-e5dcd40107e7",
        [
          0x08, 0xd7, 0x0b, 0x74, 0xe9, 0xf5, 0x45, 0x22, 0xa4, 0x25, 0xe5, 0xdc, 0xd4, 0x01, 0x07,
          0xe7,
        ],
      ],
    ])("returns UUID in binary format when given a valid UUID string", (input, expected) => {
      const result = guidToRawFormat(input);

      expect(result).toEqual(new Uint8Array(expected));
    });

    it("throws an error when given an invalid UUID string", () => {
      expect(() => guidToRawFormat("invalid")).toThrow(TypeError);
    });
  });
});
