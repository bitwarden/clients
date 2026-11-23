import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { CipherIcon } from "./cipher-icon";

jest.mock("@emotion/css", () => ({ css: () => "css" }));
jest.mock("lit", () => jest.requireActual("../lit-stories/lit-jest-mocks").litMock);
jest.mock("../icons", () => ({
  BwiIcon: jest.fn(({ name }) => name),
  Globe: jest.fn(() => "globe"),
}));

const base = { color: "#175ddc", size: "24px", theme: ThemeTypes.Light };

describe("CipherIcon", () => {
  it("draws the globe svg when the design system is off", () => {
    expect(CipherIcon({ ...base, icon: "bwi-key" })).toContain("globe");
  });

  it.each(["bwi-globe", "bwi-credit-card", "bwi-id-card", "bwi-key"])(
    "draws the %s font icon on the design-system path",
    (icon) => {
      expect(CipherIcon({ ...base, icon, designSystem: true })).toContain(icon);
    },
  );

  it("draws the favicon instead of the type icon", () => {
    const result = CipherIcon({
      ...base,
      icon: "bwi-key",
      designSystem: true,
      uri: "https://icons.test/a.png",
    });

    expect(result).toContain("https://icons.test/a.png");
    expect(result).not.toContain("bwi-key");
  });
});
