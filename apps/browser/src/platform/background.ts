import { init as initPqp, initLogging, login, logout, isLoggedIn } from "@ovrlab/pqp-network";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import MainBackground from "../background/main.background";

const logService = new ConsoleLogService(false);

// Google OAuth Client ID (Web Application type, required for launchWebAuthFlow)
const CHROME_CLIENT_ID = "277645520335-5ul3dkbpbtupbsvoh0f2ov6nj2k8a3pt.apps.googleusercontent.com";

// Microsoft OAuth Client ID (registered in Azure AD)
const MS_CLIENT_ID = "861c0051-0588-46e5-b901-9e4080ee52e4";

// Initialize PQP Network in Background Context
initPqp("chrome", {
  enableWebRtc: true,
  offscreenPath: "offscreen-document/index.html",
  googleClientId: CHROME_CLIENT_ID,
  microsoftClientId: MS_CLIENT_ID,
});

void initLogging("chrome", { offscreenIdentifier: "offscreen-document/index.html" });

// Register message handlers for popup commands
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handledTypes = ["LOGIN", "LOGIN_MICROSOFT", "LOGOUT", "CHECK_STATUS"];

  if (!message?.type || !handledTypes.includes(message.type)) {
    return false;
  }

  void (async () => {
    try {
      if (message.type === "LOGIN") {
        try {
          await login("google");
          sendResponse({ success: true });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("[PQP] Google login failed:", error);
          try {
            sendResponse({ error: (error as Error).message || "Internal error" });
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (message.type === "LOGIN_MICROSOFT") {
        try {
          await login("microsoft");
          sendResponse({ success: true });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("[PQP] Microsoft login failed:", error);
          try {
            sendResponse({ error: (error as Error).message || "Internal error" });
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (message.type === "LOGOUT") {
        await logout();
        sendResponse({ success: true });
        return;
      }

      if (message.type === "CHECK_STATUS") {
        const loggedIn = await isLoggedIn();
        sendResponse({ success: true, loggedIn });
        return;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[PQP] Error handling message:", error);
      sendResponse({ error: (error as Error).message || "Internal error" });
    }
  })();

  return true;
});

// [NEW] Redirect finish-signup from vault.bitwarden.com to the extension's own page
// When a user clicks the email verification link, it opens vault.bitwarden.com/#/finish-signup.
// The extension's RegistrationFinishComponent has PqP integration (auto-fills master password),
// but that only works inside the extension context where @ovrlab/pqp-network has access to
// Chrome extension APIs. So we intercept and redirect.
chrome.webNavigation.onCommitted.addListener(
  async (details) => {
    if (details.frameId !== 0) {
      return;
    }

    const hashMatch = details.url.match(/#\/?finish-signup\?(.+)/);
    if (!hashMatch) {
      return;
    }

    const queryString = hashMatch[1];
    const extensionUrl = chrome.runtime.getURL(`popup/index.html#/finish-signup?${queryString}`);

    try {
      await chrome.tabs.create({ url: extensionUrl });
      await chrome.tabs.remove(details.tabId);
    } catch (err) {
      logService.error("[PQP] Failed to redirect finish-signup:", err);
    }
  },
  { url: [{ hostContains: "vault.bitwarden" }] },
);

const bitwardenMain = ((self as any).bitwardenMain = new MainBackground());
bitwardenMain.bootstrap().catch((error) => logService.error(error));
