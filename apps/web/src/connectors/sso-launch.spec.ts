import { initiateSsoLaunch } from "./sso-launch";

describe("sso-launch", () => {
  let originalLocation: Location;

  const mockLocation = (search: string) => {
    Object.defineProperty(window, "location", {
      value: {
        href: "",
        origin: "https://test.bitwarden.com",
        search,
      },
      writable: true,
    });
  };

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation });
    jest.clearAllMocks();
  });

  describe("initiateSsoLaunch", () => {
    it("forwards the query string to the SSO hash route on the same origin", () => {
      mockLocation(
        "?clientId=desktop&redirectUri=bitwarden%3A%2F%2Fsso-callback&state=abc&codeChallenge=xyz",
      );

      initiateSsoLaunch();

      expect(window.location.href).toBe(
        "https://test.bitwarden.com/#/sso?clientId=desktop&redirectUri=bitwarden%3A%2F%2Fsso-callback&state=abc&codeChallenge=xyz",
      );
    });

    it("navigates to the bare SSO route when there is no query string", () => {
      mockLocation("");

      initiateSsoLaunch();

      expect(window.location.href).toBe("https://test.bitwarden.com/#/sso");
    });
  });
});
