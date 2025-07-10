import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

(function (globalContext) {
  globalContext.postMessage({ command: VaultMessages.HasBwInstalled });
})(window);
