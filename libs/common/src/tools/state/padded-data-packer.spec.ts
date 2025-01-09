import { PaddedDataPacker } from "./padded-data-packer";

describe("UserKeyEncryptor", () => {
  describe("pack", () => {
    it("should pack a stringified value", () => {
      const dataPacker = new PaddedDataPacker(32);

      const packed = dataPacker.pack({ foo: true });

      expect(packed).toEqual("32|eyJmb28iOnRydWV9|000000000000");
    });

    it("should pad to a multiple of the frame size", () => {
      const dataPacker = new PaddedDataPacker(8);

      const packed = dataPacker.pack({ foo: true });
      expect(packed.length).toEqual(24);
    });

    it("should pad to a multiple of the frame size", () => {
      const dataPacker = new PaddedDataPacker(8);

      const packed = dataPacker.pack({ foo: true });
      expect(packed.length).toEqual(24);
    });
  });

  describe("unpack", () => {
    it("should unpack a value with the same frame size", () => {
      const dataPacker = new PaddedDataPacker(32);

      const unpacked = dataPacker.unpack("32|eyJmb28iOnRydWV9|000000000000");

      expect(unpacked).toEqual({ foo: true });
    });

    it("should unpack a value with a different frame size", () => {
      const dataPacker = new PaddedDataPacker(32);

      const unpacked = dataPacker.unpack("24|eyJmb28iOnRydWV9|0000");

      expect(unpacked).toEqual({ foo: true });
    });

    it("should unpack a value whose length is a multiple of the frame size", () => {
      const dataPacker = new PaddedDataPacker(32);

      const unpacked = dataPacker.unpack("16|eyJmb28iOnRydWV9|000000000000");

      expect(unpacked).toEqual({ foo: true });
    });

    it("should throw an error when the frame size is missing", () => {
      const dataPacker = new PaddedDataPacker(512);
      const packed = `|eyJmb28iOnRydWV9|${"0".repeat(16)}`;

      expect(() => dataPacker.unpack(packed)).toThrow("missing frame size");
    });

    it("should throw an error when the length is not a multiple of the frame size", () => {
      const dataPacker = new PaddedDataPacker(16);
      const packed = "16|eyJmb28iOnRydWV9|0";

      expect(() => dataPacker.unpack(packed)).toThrow("invalid length");
    });

    it("should throw an error when the padding divider is missing", () => {
      const dataPacker = new PaddedDataPacker(16);
      const packed = "16|eyJmb28iOnRydWV90000000000000";

      expect(() => dataPacker.unpack(packed)).toThrow("missing json object");
    });

    it("should throw an error when the padding contains a non-0 character", () => {
      const dataPacker = new PaddedDataPacker(16);
      const packed = "16|eyJmb28iOnRydWV9|000000000001";

      expect(() => dataPacker.unpack(packed)).toThrow("invalid padding");
    });
  });

  it("should unpack a packed JSON-literal value", () => {
    const dataPacker = new PaddedDataPacker(8);
    const input = { foo: true };

    const packed = dataPacker.pack(input);
    const unpacked = dataPacker.unpack(packed);

    expect(unpacked).toEqual(input);
  });
});
