import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { litValues } from "../lit-stories/lit-values";

import { CipherIcon } from "./cipher-icon";

jest.mock("lit", () => jest.requireActual("../lit-stories/lit-jest-mocks").litMock);
jest.mock("../icons", () => ({ Globe: jest.fn(() => "globe") }));

describe("CipherIcon", () => {
  const props = { color: "#175ddc", size: "24px", theme: ThemeTypes.Light };
  const URI_SLOT = 1;
  const ERROR_SLOT = 2;
  const LOAD_SLOT = 3;
  const GLOBE_SLOT = 5;

  function renderedIcon() {
    const image = document.createElement("img");
    const globe = document.createElement("span");
    globe.hidden = true;
    document.createElement("div").append(image, globe);
    return { image, globe };
  }

  function dispatchTo(handler: unknown, image: HTMLImageElement) {
    const event = new Event("error");
    Object.defineProperty(event, "currentTarget", { value: image });
    (handler as (event: Event) => void)(event);
  }

  it("renders the globe when there is no icon URI", () => {
    const values = litValues(CipherIcon(props));

    expect(values).toHaveLength(2);
    expect(values[1]).toBe("globe");
  });

  it("renders the icon with a hidden globe beside it", () => {
    const values = litValues(CipherIcon({ ...props, uri: "https://192.168.1.10/favicon.ico" }));

    expect(values[URI_SLOT]).toBe("https://192.168.1.10/favicon.ico");
    expect(typeof values[ERROR_SLOT]).toBe("function");
    expect(typeof values[LOAD_SLOT]).toBe("function");
    expect(values[GLOBE_SLOT]).toBe("globe");
  });

  it("shows the globe instead of an icon that fails to load", () => {
    const values = litValues(CipherIcon({ ...props, uri: "https://192.168.1.10/favicon.ico" }));
    const { image, globe } = renderedIcon();

    dispatchTo(values[ERROR_SLOT], image);

    expect(image.hidden).toBe(true);
    expect(globe.hidden).toBe(false);
  });

  it("shows the icon again once an icon loads", () => {
    const values = litValues(CipherIcon({ ...props, uri: "https://example.com/favicon.ico" }));
    const { image, globe } = renderedIcon();

    dispatchTo(values[ERROR_SLOT], image);
    dispatchTo(values[LOAD_SLOT], image);

    expect(image.hidden).toBe(false);
    expect(globe.hidden).toBe(true);
  });
});
