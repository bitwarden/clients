import { EncString } from "./enc-string";

describe("EncString", () => {
  afterEach(() => {
    (window as any).bitwardenContainerService = undefined;
  });

  describe("parse existing", () => {
    it.each([
      ["3.data"],
      ["3.data|test"],
      ["0.iv|data"],
      ["0.iv|data|mac"],
      ["2.iv|data|mac"],
      ["2.iv|data"],
    ])("keeps %s as-is", (serialized) => {
      expect(new EncString(serialized)).toEqual({ encryptedString: serialized });
    });
  });

  it("Exit early if null", () => {
    const encString = new EncString(null);

    expect(encString).toEqual({
      encryptedString: null,
    });
  });

  describe("toJSON", () => {
    it("Should be represented by the encrypted string", () => {
      const encString = new EncString("0.iv|data");

      expect(encString.toJSON()).toBe(encString.encryptedString);
    });

    it("returns null if object is null", () => {
      expect(EncString.fromJSON(null)).toBeNull();
    });
  });
});
