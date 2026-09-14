import { hasUserAgentBrand } from "./user-agent-data";

describe("hasUserAgentBrand", () => {
  const setUserAgentData = (userAgentData: unknown) => {
    Object.defineProperty(globalThis.navigator, "userAgentData", {
      value: userAgentData,
      configurable: true,
    });
  };

  afterEach(() => {
    delete (globalThis.navigator as any).userAgentData;
  });

  it("returns true when the brand is present", () => {
    setUserAgentData({
      brands: [
        { brand: "Not=A?Brand", version: "99" },
        { brand: "DuckDuckGo", version: "151" },
        { brand: "Chromium", version: "151" },
      ],
    });

    expect(hasUserAgentBrand("DuckDuckGo")).toBe(true);
  });

  it("returns false when the brand is absent", () => {
    setUserAgentData({
      brands: [
        { brand: "Not=A?Brand", version: "99" },
        { brand: "Chromium", version: "135" },
        { brand: "Google Chrome", version: "135" },
      ],
    });

    expect(hasUserAgentBrand("DuckDuckGo")).toBe(false);
  });

  it("matches the brand exactly rather than as a substring", () => {
    setUserAgentData({ brands: [{ brand: "DuckDuckGoBrowser", version: "151" }] });

    expect(hasUserAgentBrand("DuckDuckGo")).toBe(false);
  });

  it("returns false when userAgentData is undefined", () => {
    setUserAgentData(undefined);

    expect(hasUserAgentBrand("DuckDuckGo")).toBe(false);
  });

  it("returns false when userAgentData has no brand list", () => {
    setUserAgentData({});

    expect(hasUserAgentBrand("DuckDuckGo")).toBe(false);
  });

  it("returns false when the brand list is empty", () => {
    setUserAgentData({ brands: [] });

    expect(hasUserAgentBrand("DuckDuckGo")).toBe(false);
  });
});
