import { VaultOnboardingMessages } from "@bitwarden/common/vault/enums/vault-onboarding.enum";

(function (globalContext) {
  globalContext.postMessage({ command: VaultOnboardingMessages.HasBwInstalled });
})(window);
