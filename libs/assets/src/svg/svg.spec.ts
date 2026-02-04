import * as IconExports from "./svg";
import { DynamicContentNotAllowedError, isBitSvg, svg } from "./svg";

describe("Icon", () => {
  it("exports should not expose Icon class", () => {
    expect(Object.keys(IconExports)).not.toContain("Icon");
  });

  describe("isIcon", () => {
    it("should return true when input is icon", () => {
      const result = isBitSvg(svg`icon`);

      expect(result).toBe(true);
    });

    it("should return false when input is not an icon", () => {
      const result = isBitSvg({ svg: "not an icon" });

      expect(result).toBe(false);
    });
  });

  describe("template literal", () => {
    it("should throw when attempting to create dynamic icons", () => {
      const dynamic = "some user input";

      const f = () => svg`static and ${dynamic}`;

      expect(f).toThrow(DynamicContentNotAllowedError);
    });

    it("should return svg content when supplying icon with svg string", () => {
      const icon = svg`safe static content`;

      expect(icon.svg).toBe("safe static content");
    });
  });
});
