import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { RendererUiRequestService } from "../../platform/main/renderer-ui-request.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { MainVaultDecryptionService } from "../../vault/main/main-vault-decryption.service";
import { SshAgentPromptType } from "../models/ssh-agent-setting";

import { MainSshAgentOrchestrator, SshSignRequest } from "./main-ssh-agent-orchestrator.service";

const userId = "user-1" as UserId;

function sshCipher(id: string, name = "key", privateKey = "pk"): CipherView {
  const view = new CipherView();
  view.id = id;
  view.name = name;
  view.type = CipherType.SshKey;
  (view as any).sshKey = { privateKey };
  return view;
}

const signRequest = (overrides: Partial<SshSignRequest> = {}): SshSignRequest => ({
  cipherId: "c1",
  processName: "git",
  isAgentForwarding: false,
  ...overrides,
});

describe("MainSshAgentOrchestrator", () => {
  let vaultDecryptionService: MockProxy<MainVaultDecryptionService>;
  let rendererUiRequestService: MockProxy<RendererUiRequestService>;
  let desktopSettingsService: MockProxy<DesktopSettingsService>;
  let orchestrator: MainSshAgentOrchestrator;

  const setPromptBehavior = (type: SshAgentPromptType) => {
    (desktopSettingsService as any).sshAgentPromptBehavior$ = of(type);
  };

  beforeEach(() => {
    vaultDecryptionService = mock<MainVaultDecryptionService>();
    rendererUiRequestService = mock<RendererUiRequestService>();
    desktopSettingsService = mock<DesktopSettingsService>();
    setPromptBehavior(SshAgentPromptType.Always);

    orchestrator = new MainSshAgentOrchestrator(
      vaultDecryptionService,
      rendererUiRequestService,
      desktopSettingsService,
      mock<LogService>(),
    );
  });

  describe("toAgentKeys", () => {
    it("keeps only non-deleted, non-archived SSH-key ciphers", () => {
      const active = sshCipher("c1", "active");
      const deleted = sshCipher("c2");
      deleted.deletedDate = new Date();
      const login = new CipherView();
      login.type = CipherType.Login;

      const keys = orchestrator.toAgentKeys([active, deleted, login]);

      expect(keys).toEqual([{ name: "active", privateKey: "pk", cipherId: "c1" }]);
    });
  });

  describe("handleSignRequest", () => {
    it("returns false when the cipher is not found", async () => {
      vaultDecryptionService.getDecryptedCiphersOfType.mockResolvedValue([]);

      await expect(orchestrator.handleSignRequest(signRequest(), userId)).resolves.toBe(false);
      expect(rendererUiRequestService.request).not.toHaveBeenCalled();
    });

    it("approves without prompting when prompt behavior is Never", async () => {
      setPromptBehavior(SshAgentPromptType.Never);
      vaultDecryptionService.getDecryptedCiphersOfType.mockResolvedValue([sshCipher("c1")]);

      await expect(orchestrator.handleSignRequest(signRequest(), userId)).resolves.toBe(true);
      expect(rendererUiRequestService.request).not.toHaveBeenCalled();
    });

    it("prompts the renderer and returns its decision when prompt behavior is Always", async () => {
      vaultDecryptionService.getDecryptedCiphersOfType.mockResolvedValue([sshCipher("c1")]);
      rendererUiRequestService.request.mockResolvedValue(true as never);

      await expect(orchestrator.handleSignRequest(signRequest(), userId)).resolves.toBe(true);
      expect(rendererUiRequestService.request).toHaveBeenCalledTimes(1);
    });

    it("returns false when the user denies the prompt", async () => {
      vaultDecryptionService.getDecryptedCiphersOfType.mockResolvedValue([sshCipher("c1")]);
      rendererUiRequestService.request.mockResolvedValue(false as never);

      await expect(orchestrator.handleSignRequest(signRequest(), userId)).resolves.toBe(false);
    });

    it("remembers approvals under RememberUntilLock and does not re-prompt", async () => {
      setPromptBehavior(SshAgentPromptType.RememberUntilLock);
      vaultDecryptionService.getDecryptedCiphersOfType.mockResolvedValue([sshCipher("c1")]);
      rendererUiRequestService.request.mockResolvedValue(true as never);

      await expect(orchestrator.handleSignRequest(signRequest(), userId)).resolves.toBe(true);
      // Second request for the same cipher/host should not prompt again.
      await expect(orchestrator.handleSignRequest(signRequest(), userId)).resolves.toBe(true);
      expect(rendererUiRequestService.request).toHaveBeenCalledTimes(1);
    });

    it("re-prompts after authorizations are cleared", async () => {
      setPromptBehavior(SshAgentPromptType.RememberUntilLock);
      vaultDecryptionService.getDecryptedCiphersOfType.mockResolvedValue([sshCipher("c1")]);
      rendererUiRequestService.request.mockResolvedValue(true as never);

      await orchestrator.handleSignRequest(signRequest(), userId);
      orchestrator.clearAuthorizations();
      await orchestrator.handleSignRequest(signRequest(), userId);

      expect(rendererUiRequestService.request).toHaveBeenCalledTimes(2);
    });
  });

  describe("getAgentKeysForUser", () => {
    it("returns projected SSH keys for the user", async () => {
      vaultDecryptionService.getDecryptedCiphersOfType.mockResolvedValue([sshCipher("c1", "n")]);

      await expect(orchestrator.getAgentKeysForUser(userId)).resolves.toEqual([
        { name: "n", privateKey: "pk", cipherId: "c1" },
      ]);
      expect(vaultDecryptionService.getDecryptedCiphersOfType).toHaveBeenCalledWith(
        userId,
        CipherType.SshKey,
      );
    });
  });
});
