import { initiateWebAppSso, initiateBrowserSso } from "./sso";

describe("sso", () => {
  let originalLocation: Location;
  let originalPostMessage: any;
  let postMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original window methods
    originalLocation = window.location;
    originalPostMessage = window.postMessage;

    // Mock location
    Object.defineProperty(window, "location", {
      value: {
        href: "",
        origin: "https://test.bitwarden.com",
      },
      writable: true,
    });

    // Mock postMessage
    postMessageSpy = jest.spyOn(window, "postMessage");

    // Set up document
    document.cookie = "ssoHandOffMessage=SSO login successful;SameSite=strict";
    const contentElement = document.createElement("div");
    contentElement.id = "content";
    document.body.appendChild(contentElement);
  });

  afterEach(() => {
    // Restore original window methods
    Object.defineProperty(window, "location", { value: originalLocation });
    window.postMessage = originalPostMessage;

    // Clean up document
    const contentElement = document.getElementById("content");
    if (contentElement) {
      document.body.removeChild(contentElement);
    }
    document.cookie = "ssoHandOffMessage=;SameSite=strict;max-age=0";

    // Clear mocks
    jest.clearAllMocks();
  });

  describe("initiateWebAppSso", () => {
    it("redirects to the SSO component with code and state", () => {
      const code = "testcode";
      const state = "teststate";

      initiateWebAppSso(code, state);

      expect(window.location.href).toBe(
        "https://test.bitwarden.com/#/sso?code=testcode&state=teststate",
      );
    });

    it("redirects to the return URI when included in state", () => {
      const code = "testcode";
      const state = "teststate_returnUri='/organizations'";

      initiateWebAppSso(code, state);

      expect(window.location.href).toBe("https://test.bitwarden.com/#/organizations");
    });

    it("handles empty code parameter", () => {
      initiateWebAppSso("", "teststate");
      expect(window.location.href).toBe("https://test.bitwarden.com/#/sso?code=&state=teststate");
    });

    it("handles empty state parameter", () => {
      initiateWebAppSso("testcode", "");
      expect(window.location.href).toBe("https://test.bitwarden.com/#/sso?code=testcode&state=");
    });
  });

  describe("initiateBrowserSso", () => {
    it("posts message with code and state", () => {
      const code = "testcode";
      const state = "teststate";
      const lastpass = false;

      initiateBrowserSso(code, state, lastpass);

      expect(postMessageSpy).toHaveBeenCalledWith(
        { command: "authResult", code, state, lastpass },
        window.location.origin,
      );
    });

    it("updates content with message from cookie", () => {
      const code = "testcode";
      const state = "teststate";
      const lastpass = false;

      initiateBrowserSso(code, state, lastpass);

      const contentElement = document.getElementById("content");
      const paragraphElement = contentElement?.querySelector("p");
      expect(paragraphElement?.innerText).toBe("SSO login successful");
    });

    it("handles lastpass flag correctly", () => {
      const code = "testcode";
      const state = "teststate";
      const lastpass = true;

      initiateBrowserSso(code, state, lastpass);

      expect(postMessageSpy).toHaveBeenCalledWith(
        { command: "authResult", code, state, lastpass },
        window.location.origin,
      );
    });
  });
});
