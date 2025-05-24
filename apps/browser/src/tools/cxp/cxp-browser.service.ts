import { filter } from "rxjs";

import { fromChromeEvent } from "../../platform/browser/from-chrome-event";

export class CXPBrowserService {
  init() {
    fromChromeEvent(chrome.runtime.onMessageExternal)
      .pipe(
        filter(([message]) => {
          return (
            typeof message === "object" &&
            typeof message.type === "string" &&
            message.type === "FIDO-CXP-PING"
          );
        }),
      )
      .subscribe(([message, sender, sendResponse]) => {
        const pongResponse = {
          type: "FIDO-CXP-PONG",
          supportedVersions: ["1.0"],
          exportRequest: {
            payload: "base64",
            importerUsername: "aaberg@example.com",
            importerUrl: "https://bitwarden.com/.well-known/cxp.json",
            requestSignature: "base64",
          },
        };

        sendResponse(pongResponse);
      });
  }
}
