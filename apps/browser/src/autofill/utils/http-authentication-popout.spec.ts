import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
import { AutofillMessageCommand } from "../enums/autofill-message.enums";

import {
  closeAllHttpAuthenticationPopouts,
  closeHttpAuthenticationPopout,
  isHttpAuthenticationPopoutSender,
  isHttpAuthenticationSelectionResponse,
  openHttpAuthenticationPopout,
} from "./http-authentication-popout";

describe("http-authentication-popout", () => {
  const sessionId = "session-id";
  const popoutUrl = (key: string) =>
    `chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=${key}#/http-authentication`;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isHttpAuthenticationPopoutSender", () => {
    it("accepts the popout opened for the session", () => {
      expect(
        isHttpAuthenticationPopoutSender(
          popoutUrl(`autofill_HttpAuthenticationPopout_${sessionId}`),
          sessionId,
        ),
      ).toBe(true);
    });

    it.each([
      ["another session's popout", popoutUrl("autofill_HttpAuthenticationPopout_other-session")],
      ["a different extension page", "chrome-extension://id/notification/bar.html"],
      [
        "a web page posing as the popout",
        `https://attacker.example/popup/index.html?singleActionPopout=autofill_HttpAuthenticationPopout_${sessionId}`,
      ],
      ["an unparsable URL", "not a url"],
      ["no URL", undefined],
    ])("rejects %s", (_, senderUrl) => {
      expect(isHttpAuthenticationPopoutSender(senderUrl, sessionId)).toBe(false);
    });
  });

  describe("isHttpAuthenticationSelectionResponse", () => {
    it.each([
      [
        {
          command: AutofillMessageCommand.httpAuthenticationSelectionResponse,
          sessionId,
          cipherId: "id",
        },
      ],
      [{ command: AutofillMessageCommand.httpAuthenticationSelectionResponse, sessionId }],
    ])("accepts a selection response %#", (message) => {
      expect(isHttpAuthenticationSelectionResponse(message)).toBe(true);
    });

    it.each([
      [null],
      ["message"],
      [{ command: "other", sessionId }],
      [{ command: AutofillMessageCommand.httpAuthenticationSelectionResponse }],
      [
        {
          command: AutofillMessageCommand.httpAuthenticationSelectionResponse,
          sessionId,
          cipherId: 1,
        },
      ],
    ])("rejects a malformed message %#", (message) => {
      expect(isHttpAuthenticationSelectionResponse(message)).toBe(false);
    });
  });

  it("opens the popout with the session, origin and offered logins", async () => {
    const openPopout = jest
      .spyOn(BrowserPopupUtils, "openPopout")
      .mockResolvedValue({ id: 7 } as chrome.windows.Window);

    const windowId = await openHttpAuthenticationPopout({
      sessionId,
      senderWindowId: 3,
      requestOrigin: "https://intranet.example.com",
      cipherIds: ["first-id", "second-id"],
    });

    expect(windowId).toBe(7);
    const [path, options] = openPopout.mock.calls[0];
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("sessionId")).toBe(sessionId);
    expect(query.get("requestOrigin")).toBe("https://intranet.example.com");
    expect(query.get("cipherIds")).toBe("first-id,second-id");
    expect(options).toEqual(
      expect.objectContaining({
        singleActionKey: `autofill_HttpAuthenticationPopout_${sessionId}`,
        senderWindowId: 3,
      }),
    );
  });

  it("closes the session's popout", async () => {
    const closePopout = jest
      .spyOn(BrowserPopupUtils, "closeSingleActionPopout")
      .mockResolvedValue(undefined);

    await closeHttpAuthenticationPopout(sessionId);

    expect(closePopout).toHaveBeenCalledWith(`autofill_HttpAuthenticationPopout_${sessionId}`);
  });

  it("closes every HTTP authentication popout by their shared key prefix", async () => {
    const closePopout = jest
      .spyOn(BrowserPopupUtils, "closeSingleActionPopout")
      .mockResolvedValue(undefined);

    await closeAllHttpAuthenticationPopouts();

    expect(closePopout).toHaveBeenCalledWith("autofill_HttpAuthenticationPopout");
  });
});
