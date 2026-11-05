import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";

export const HttpAuthenticationPopoutMessage = Object.freeze({
  SelectionResponse: "httpAuthenticationSelectionResponse",
} as const);

/**
 * Sent by the popout when the user resolves an HTTP authentication challenge. An absent
 * `cipherId` means the user declined, and the challenge is left to the browser's own prompt.
 */
export type HttpAuthenticationSelectionResponse = {
  command: typeof HttpAuthenticationPopoutMessage.SelectionResponse;
  sessionId: string;
  cipherId?: string;
};

export const HTTP_AUTHENTICATION_POPOUT_PATH = "popup/index.html#/http-authentication";

const httpAuthenticationPopoutKeyPrefix = "autofill_HttpAuthenticationPopout";

function getHttpAuthenticationPopoutKey(sessionId: string): string {
  return `${httpAuthenticationPopoutKeyPrefix}_${sessionId}`;
}

/**
 * Whether a message sender is the extension popout opened for the given session. Only that
 * window may resolve the session's challenge.
 */
export function isHttpAuthenticationPopoutSender(
  senderUrl: string | undefined,
  sessionId: string,
): boolean {
  if (senderUrl == null) {
    return false;
  }

  let parsedSenderUrl: URL;
  try {
    parsedSenderUrl = new URL(senderUrl);
  } catch {
    return false;
  }

  const popupPageUrl = new URL(BrowserApi.getRuntimeURL("popup/index.html"));

  return (
    parsedSenderUrl.origin === popupPageUrl.origin &&
    parsedSenderUrl.pathname === popupPageUrl.pathname &&
    parsedSenderUrl.searchParams.get("singleActionPopout") ===
      getHttpAuthenticationPopoutKey(sessionId)
  );
}

export function isHttpAuthenticationSelectionResponse(
  message: unknown,
): message is HttpAuthenticationSelectionResponse {
  if (message == null || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<HttpAuthenticationSelectionResponse>;

  return (
    candidate.command === HttpAuthenticationPopoutMessage.SelectionResponse &&
    typeof candidate.sessionId === "string" &&
    (candidate.cipherId == null || typeof candidate.cipherId === "string")
  );
}

/**
 * Opens a popout window that asks the user which login, if any, answers an HTTP
 * authentication challenge.
 *
 * @returns The id of the opened window, or undefined if no window was created.
 */
export async function openHttpAuthenticationPopout(options: {
  sessionId: string;
  senderWindowId?: number;
  requestUrl: string;
  cipherIds: string[];
}): Promise<number | undefined> {
  const { sessionId, senderWindowId, requestUrl, cipherIds } = options;
  const queryParameters = new URLSearchParams({
    sessionId,
    requestUrl,
    cipherIds: cipherIds.join(","),
  });

  const popoutWindow = await BrowserPopupUtils.openPopout(
    `${HTTP_AUTHENTICATION_POPOUT_PATH}?${queryParameters.toString()}`,
    {
      singleActionKey: getHttpAuthenticationPopoutKey(sessionId),
      senderWindowId,
      windowOptions: { height: 570 },
    },
  );

  return popoutWindow?.id;
}

export async function closeHttpAuthenticationPopout(sessionId: string): Promise<void> {
  await BrowserPopupUtils.closeSingleActionPopout(getHttpAuthenticationPopoutKey(sessionId));
}
