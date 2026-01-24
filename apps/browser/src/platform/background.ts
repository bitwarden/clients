import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { init as initPqp, ServiceLocator, initLogging, login, logout } from "@ovrlab/pqp-network"; // [NEW] PQP Network Integration

import MainBackground from "../background/main.background";

const logService = new ConsoleLogService(false);

// [NEW] Initialize PQP Network in Background Context
    initPqp("chrome", {
    enableWebRtc: true,
    offscreenPath: "offscreen-document/index.html",
  });

  initLogging("chrome");
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
