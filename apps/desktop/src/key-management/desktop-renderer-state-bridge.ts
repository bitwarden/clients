import { JsWasmStateBridge } from "@bitwarden/common/key-management/state-bridge";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { SymmetricKey } from "@bitwarden/sdk-internal";

/**
 * The renderer's {@link JsWasmStateBridge}. Main owns the user key, so instead of reading a local
 * copy this bridge retrieves it from main over IPC on demand. The renderer never writes the key
 * back, so `set_user_key`/`clear_user_key` are no-ops.
 */
export class DesktopRendererStateBridge extends JsWasmStateBridge {
  override async get_user_key(): Promise<SymmetricKey | null> {
    const { unlocked } = await ipc.keyManagement.unlock.getUnlockSessions();
    const vaultState = unlocked[this.userId];
    return vaultState == null ? null : SymmetricCryptoKey.fromString(vaultState.userKeyB64).toSdk();
  }

  override async set_user_key(_userKey: SymmetricKey): Promise<void> {
    // Main owns the user key; the renderer never persists it.
  }

  override async clear_user_key(): Promise<void> {
    // Main owns the user key; the renderer never clears it.
  }
}
