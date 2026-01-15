import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { init as initPqp, ServiceLocator, initLogging, login, logout } from "@ovrlab/pqp-network"; // [NEW] PQP Network Integration
import { handleWebRtcMessage, setupWebRtcListeners } from "./pqp-webrtc-helper";

import MainBackground from "../background/main.background";

const logService = new ConsoleLogService(false);

// [NEW] Initialize PQP Network in Background Context
  initPqp("chrome", { context: "background" });
  initLogging("chrome");
  console.log("[PQP] Background Initialized");

  // [NEW] Setup WebRTC listeners
  setupWebRtcListeners();

  // [NEW] Register message handlers for popup commands
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      // Auth handlers
      if (message.type === 'LOGIN') {
        login();
        sendResponse({ success: true });
        return;
      }
  
      if (message.type === 'LOGOUT') {
        await logout();
        sendResponse({ success: true });
        return;
      }
  
      // WebRTC handler
      const handledWebRtc = await handleWebRtcMessage(message, sendResponse);
      if (handledWebRtc) return;
    })();
  
    // Return true to indicate async response (if needed by other handlers, keep in mind multiple listeners)
    // returning true here is good practice for async sendResponse
    return true; 
  });

const bitwardenMain = ((self as any).bitwardenMain = new MainBackground());
bitwardenMain.bootstrap().catch((error) => logService.error(error));
