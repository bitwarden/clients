import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

(function (globalContext) {
  // Send a message to the window that the popup opened
  globalContext.postMessage({ command: VaultMessages.PopupOpened });
})(window);
