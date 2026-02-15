import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { init as initPqp, ServiceLocator, initLogging, login, logout, GOOGLE_OAUTH_SCOPES } from "@ovrlab/pqp-network"; // [NEW] PQP Network Integration

import MainBackground from "../background/main.background";

const logService = new ConsoleLogService(false);

// Google OAuth Client ID (Web Application type, required for launchWebAuthFlow)
const CHROME_CLIENT_ID = '277645520335-5ul3dkbpbtupbsvoh0f2ov6nj2k8a3pt.apps.googleusercontent.com';

// [NEW] Initialize PQP Network in Background Context
initPqp("chrome", {
  enableWebRtc: true,
  offscreenPath: "offscreen-document/index.html",
  chromeIdentityConfig: {
    clientId: CHROME_CLIENT_ID,
    scopes: GOOGLE_OAUTH_SCOPES,
  },
});

initLogging("chrome", { offscreenIdentifier: "offscreen-document/index.html" });
  console.log("[PQP] Background Initialized");

  // [NEW] Setup WebRTC listeners
  // setupWebRtcListeners();

  // [NEW] Register message handlers for popup commands
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // 1. Auth handlers
    if (message.type === "LOGIN") {
      (async () => {
        login();
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.type === "LOGOUT") {
      (async () => {
        await logout();
        sendResponse({ success: true });
      })();
      return true;
    }


    // 3. Fallthrough - Not handled by us
    return false;
  });

const bitwardenMain = ((self as any).bitwardenMain = new MainBackground());
bitwardenMain.bootstrap().catch((error) => logService.error(error));
