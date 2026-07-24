import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { RendererUiRequestService } from "../../platform/main/renderer-ui-request.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { MainVaultDecryptionService } from "../../vault/main/main-vault-decryption.service";
import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import { SshAgentPromptType } from "../models/ssh-agent-setting";

export type SshAgentKey = { name: string; privateKey: string; cipherId: string };

export interface SshSignRequest {
  cipherId: string;
  processName: string;
  isAgentForwarding: boolean;
  namespace?: string;
  hostFingerprint?: string;
}

const LOCAL_HOST_KEY = "local";
const SIGN_REQUEST_TIMEOUT = 60_000;

/**
 * Main-process orchestration for the SSH agent v2 flow.
 *
 * This relocates the approval/authorization logic that currently lives in the renderer
 * `SshAgentService` ({@link ../services/ssh-agent.service.ts}) into the main process. The Rust
 * agent's sign/list callbacks (owned by {@link MainSshAgentService}) can resolve here directly —
 * decrypting SSH-key ciphers via {@link MainVaultDecryptionService} and requesting user approval via
 * {@link RendererUiRequestService} — instead of round-tripping the whole decision through the
 * renderer.
 *
 * ⚠️ NOT WIRED / partial. This covers the per-request approval + key-projection core (testable in
 * isolation). The vault-unlock wait and the reactive key-push pipeline remain to be wired against
 * the running app (they depend on live vault state observation in main). Gated on
 * `FeatureFlag.SSHAgentV2`; v1 is untouched (PM-30758). Requires key-management review before
 * enabling (decrypted SSH private keys flow through main).
 */
export class MainSshAgentOrchestrator {
  // cipherId -> set of authorized host keys (LOCAL_HOST_KEY for local, host fingerprint for forwarded).
  private authorizedKeys = new Map<string, Set<string>>();

  constructor(
    private vaultDecryptionService: MainVaultDecryptionService,
    private rendererUiRequestService: RendererUiRequestService,
    private desktopSettingsService: DesktopSettingsService,
    private logService: LogService,
  ) {}

  /**
   * Decrypt the active user's SSH-key ciphers and project them to the shape the native agent needs.
   */
  async getAgentKeysForUser(userId: UserId): Promise<SshAgentKey[]> {
    const ciphers = await this.vaultDecryptionService.getDecryptedCiphersOfType(
      userId,
      CipherType.SshKey,
    );
    return this.toAgentKeys(ciphers);
  }

  /**
   * Resolve a sign request: decrypt the user's SSH keys, and — depending on prompt behavior and
   * remembered approvals — either approve directly or ask the renderer to show the approval dialog.
   * Returns whether the sign should proceed.
   */
  async handleSignRequest(request: SshSignRequest, userId: UserId): Promise<boolean> {
    const ciphers = await this.vaultDecryptionService.getDecryptedCiphersOfType(
      userId,
      CipherType.SshKey,
    );
    const cipher = ciphers.find((c) => c.id === request.cipherId);
    if (cipher == null) {
      return false;
    }

    if (
      !(await this.needsAuthorization(
        request.cipherId,
        request.isAgentForwarding,
        request.hostFingerprint,
      ))
    ) {
      return true;
    }

    const approved = await this.rendererUiRequestService.request<boolean>(
      SSH_AGENT_IPC_CHANNELS.APPROVAL_REQUEST,
      SSH_AGENT_IPC_CHANNELS.APPROVAL_RESPONSE,
      {
        cipherName: cipher.name,
        application: request.processName,
        isAgentForwarding: request.isAgentForwarding,
        namespace: request.namespace,
      },
      { timeoutMs: SIGN_REQUEST_TIMEOUT, defaultResponse: false },
    );

    if (approved) {
      this.rememberAuthorization(
        request.cipherId,
        request.isAgentForwarding,
        request.hostFingerprint,
      );
    }
    return approved;
  }

  /** Clear all remembered approvals (on vault lock or account switch). */
  clearAuthorizations(): void {
    this.authorizedKeys = new Map();
  }

  toAgentKeys(ciphers: CipherView[]): SshAgentKey[] {
    return ciphers
      .filter((c) => c.type === CipherType.SshKey && !c.isDeleted && !c.isArchived)
      .map((c) => ({ name: c.name, privateKey: c.sshKey.privateKey, cipherId: c.id }));
  }

  private async needsAuthorization(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): Promise<boolean> {
    const promptType = await firstValueFrom(this.desktopSettingsService.sshAgentPromptBehavior$);
    switch (promptType) {
      case SshAgentPromptType.Never:
        return false;
      case SshAgentPromptType.Always:
        return true;
      case SshAgentPromptType.RememberUntilLock: {
        const key = isForwarded ? hostFingerprint : LOCAL_HOST_KEY;
        if (!key) {
          return true;
        }
        return !(this.authorizedKeys.get(cipherId)?.has(key) ?? false);
      }
      default:
        return true;
    }
  }

  private rememberAuthorization(
    cipherId: string,
    isForwarded: boolean,
    hostFingerprint?: string,
  ): void {
    const key = isForwarded ? hostFingerprint : LOCAL_HOST_KEY;
    if (!key) {
      return;
    }
    const approved = this.authorizedKeys.get(cipherId) ?? new Set<string>();
    approved.add(key);
    this.authorizedKeys.set(cipherId, approved);
  }
}
