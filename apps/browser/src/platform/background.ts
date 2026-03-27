import { init as initPqp, initLogging, login, logout, isLoggedIn, rotateKeypair } from "@ovrlab/pqp-network";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import MainBackground from "../background/main.background";

import { MasterPasswordApiService } from "@bitwarden/common/auth/services/master-password/master-password-api.service.implementation";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { firstValueFrom } from "rxjs";

// Type for rotateKeypair with options (until pqp-network types are updated in node_modules)
type RotateKeypairFn = (options?: {
  onBeforeFinalize?: (oldDerivedPw: string, newDerivedPw: string) => Promise<void>;
}) => Promise<{ publicKey: string; privateKey: string }>;

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
  const handledTypes = ["LOGIN", "LOGIN_MICROSOFT", "LOGOUT", "CHECK_STATUS", "ROTATE_KEYS"];

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

      if (message.type === "ROTATE_KEYS") {
        try {
          const main = (self as any).bitwardenMain as MainBackground;

          await (rotateKeypair as RotateKeypairFn)({
            onBeforeFinalize: async (oldDerivedPw: string, newDerivedPw: string) => {
              // Get active user context
              const activeUser = await firstValueFrom(main.accountService.activeAccount$);
              if (!activeUser) {
                throw new Error("No active Bitwarden user — cannot update password");
              }
              const userId = activeUser.id;
              const email = activeUser.email;
              const kdfConfig = await firstValueFrom(
                main.kdfConfigService.getKdfConfig$(userId),
              );

              // Derive old + new master keys
              const oldMasterKey = await main.keyService.makeMasterKey(oldDerivedPw, email, kdfConfig);
              const newMasterKey = await main.keyService.makeMasterKey(newDerivedPw, email, kdfConfig);

              // Hash for server verification
              const oldServerHash = await main.keyService.hashMasterKey(oldDerivedPw, oldMasterKey);
              const newServerHash = await main.keyService.hashMasterKey(newDerivedPw, newMasterKey);

              // Re-wrap user key with new master key
              const decryptedUserKey = await main.masterPasswordService.decryptUserKeyWithMasterKey(
                oldMasterKey,
                userId,
              );
              if (!decryptedUserKey) {
                throw new Error("Could not decrypt user key — cannot update Bitwarden password");
              }
              const [, newEncryptedUserKey] = await main.keyService.encryptUserKeyWithMasterKey(
                newMasterKey,
                decryptedUserKey,
              );

              // Send password change to Bitwarden server
              const masterPwApi = new MasterPasswordApiService(main.apiService, main.logService);
              const request = new PasswordRequest();
              request.masterPasswordHash = oldServerHash;
              request.newMasterPasswordHash = newServerHash;
              request.key = newEncryptedUserKey.encryptedString as string;
              request.masterPasswordHint = "";
              await masterPwApi.postPassword(request);
            },
          });
          sendResponse({ success: true });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("[PQP] Key rotation failed:", error);
          try {
            sendResponse({ error: (error as Error).message || "Key rotation failed" });
          } catch {
            /* ignore */
          }
        }
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

    // Only redirect email verification links (fromEmail=true).
    // Org invite flows also use /finish-signup but rely on web-only services.
    const params = new URLSearchParams(queryString);
    if (params.get("fromEmail") !== "true") {
      return;
    }
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
