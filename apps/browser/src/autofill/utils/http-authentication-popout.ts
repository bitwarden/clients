import { CommandDefinition } from "@bitwarden/common/platform/messaging";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
import { AutofillMessageCommand } from "../enums/autofill-message.enums";

/**
 * Sent by the popout when the user resolves an HTTP authentication challenge. An absent
 * `cipherId` means the user declined, and the challenge is left to the browser's own prompt.
 */
export type HttpAuthenticationSelectionResponse = {
  sessionId: string;
  cipherId?: string;
};

export const HTTP_AUTHENTICATION_SELECTION_RESPONSE_COMMAND =
  new CommandDefinition<HttpAuthenticationSelectionResponse>(
    AutofillMessageCommand.httpAuthenticationSelectionResponse,
  );

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

/**
 * Whether a message is a well-formed selection response. The command alone doesn't establish the
 * payload's shape, because any extension context can send a message with that command.
 */
export function isHttpAuthenticationSelectionResponse(
  message: unknown,
): message is HttpAuthenticationSelectionResponse {
  if (message == null || typeof message !== "object") {
    return false;
  }

  const candidate = message as { command?: unknown } & Partial<HttpAuthenticationSelectionResponse>;

  return (
    candidate.command === HTTP_AUTHENTICATION_SELECTION_RESPONSE_COMMAND.command &&
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
  /** The origin of the challenged request. Only the origin is shown, never the site's realm text. */
  requestOrigin: string;
  cipherIds: string[];
}): Promise<number | undefined> {
  const { sessionId, senderWindowId, requestOrigin, cipherIds } = options;
  const queryParameters = new URLSearchParams({
    sessionId,
    requestOrigin,
    cipherIds: cipherIds.join(","),
  });

  const popoutWindow = await BrowserPopupUtils.openPopout(
    `${HTTP_AUTHENTICATION_POPOUT_PATH}?${queryParameters.toString()}`,
    {
      singleActionKey: getHttpAuthenticationPopoutKey(sessionId),
      senderWindowId,
      windowOptions: { height: 600 },
    },
  );

  return popoutWindow?.id;
}

export async function closeHttpAuthenticationPopout(sessionId: string): Promise<void> {
  await BrowserPopupUtils.closeSingleActionPopout(getHttpAuthenticationPopoutKey(sessionId));
}

/**
 * Closes every open HTTP authentication popout, whatever its session. Each session resolves its
 * challenge without credentials when its window closes, so the browser's own prompt shows for it.
 */
export async function closeAllHttpAuthenticationPopouts(): Promise<void> {
  // Popout keys are matched by substring, so the shared prefix matches every session's key.
  await BrowserPopupUtils.closeSingleActionPopout(httpAuthenticationPopoutKeyPrefix);
}
