import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SshKeyApi } from "@bitwarden/common/vault/models/api/ssh-key.api";
import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";
import { DialogService, ToastService } from "@bitwarden/components";
import * as sdkInternal from "@bitwarden/sdk-internal";

import { DefaultSshImportPromptService } from "./default-ssh-import-prompt.service";

jest.mock("@bitwarden/sdk-internal");

const exampleSshKey = {
  privateKey: "private_key",
  publicKey: "public_key",
  fingerprint: "key_fingerprint",
} as sdkInternal.SshKeyView;

const exampleEcdsaKey = {
  privateKey: "ecdsa_private_key",
  publicKey: "ecdsa-sha2-nistp256 AAAA...",
  fingerprint: "ecdsa_fingerprint",
} as sdkInternal.SshKeyView;

const exampleSshKeyData = new SshKeyData(
  new SshKeyApi({
    publicKey: exampleSshKey.publicKey,
    privateKey: exampleSshKey.privateKey,
    keyFingerprint: exampleSshKey.fingerprint,
  }),
);

describe("SshImportPromptService", () => {
  let sshImportPromptService: DefaultSshImportPromptService;

  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let i18nService: MockProxy<I18nService>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    platformUtilsService = mock<PlatformUtilsService>();
    i18nService = mock<I18nService>();
    configService = mock<ConfigService>();
    logService = mock<LogService>();

    configService.getFeatureFlag.mockResolvedValue(false);

    sshImportPromptService = new DefaultSshImportPromptService(
      dialogService,
      toastService,
      platformUtilsService,
      i18nService,
      configService,
      logService,
    );
    jest.clearAllMocks();
  });

  describe("importSshKeyFromClipboard()", () => {
    it("imports unencrypted ssh key", async () => {
      jest.spyOn(sdkInternal, "import_ssh_key").mockReturnValue(exampleSshKey);
      platformUtilsService.readFromClipboard.mockResolvedValue("ssh_key");
      expect(await sshImportPromptService.importSshKeyFromClipboard()).toEqual(exampleSshKeyData);
    });

    it("requests password for encrypted ssh key", async () => {
      jest
        .spyOn(sdkInternal, "import_ssh_key")
        .mockImplementationOnce(() => {
          throw { variant: "PasswordRequired" };
        })
        .mockImplementationOnce(() => exampleSshKey);
      dialogService.open.mockReturnValue({ closed: new BehaviorSubject("password") } as any);
      platformUtilsService.readFromClipboard.mockResolvedValue("ssh_key");

      expect(await sshImportPromptService.importSshKeyFromClipboard()).toEqual(exampleSshKeyData);
      expect(dialogService.open).toHaveBeenCalled();
    });

    it("cancels when no password was provided", async () => {
      jest.spyOn(sdkInternal, "import_ssh_key").mockImplementationOnce(() => {
        throw { variant: "PasswordRequired" };
      });
      dialogService.open.mockReturnValue({ closed: new BehaviorSubject("") } as any);
      platformUtilsService.readFromClipboard.mockResolvedValue("ssh_key");

      expect(await sshImportPromptService.importSshKeyFromClipboard()).toEqual(null);
      expect(dialogService.open).toHaveBeenCalled();
    });

    it("passes through error on no password", async () => {
      jest.spyOn(sdkInternal, "import_ssh_key").mockImplementationOnce(() => {
        throw { variant: "UnsupportedKeyType" };
      });
      platformUtilsService.readFromClipboard.mockResolvedValue("ssh_key");

      expect(await sshImportPromptService.importSshKeyFromClipboard()).toEqual(null);
      expect(i18nService.t).toHaveBeenCalledWith("sshKeyTypeUnsupported");
    });

    it("passes through error with password", async () => {
      jest
        .spyOn(sdkInternal, "import_ssh_key")
        .mockClear()
        .mockImplementationOnce(() => {
          throw { variant: "PasswordRequired" };
        })
        .mockImplementationOnce(() => {
          throw { variant: "UnsupportedKeyType" };
        });
      platformUtilsService.readFromClipboard.mockResolvedValue("ssh_key");
      dialogService.open.mockReturnValue({ closed: new BehaviorSubject("password") } as any);

      expect(await sshImportPromptService.importSshKeyFromClipboard()).toEqual(null);
      expect(i18nService.t).toHaveBeenCalledWith("sshKeyTypeUnsupported");
    });

    it("blocks ECDSA key import when SSHecdsa flag is disabled", async () => {
      jest.spyOn(sdkInternal, "import_ssh_key").mockReturnValue(exampleEcdsaKey);
      platformUtilsService.readFromClipboard.mockResolvedValue("ecdsa_key");
      configService.getFeatureFlag.mockResolvedValue(false);

      expect(await sshImportPromptService.importSshKeyFromClipboard()).toBeNull();
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.SSHecdsa);
      expect(logService.error).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(i18nService.t).toHaveBeenCalledWith("sshKeyTypeUnsupported");
    });

    it("allows ECDSA key import when SSHecdsa flag is enabled", async () => {
      jest.spyOn(sdkInternal, "import_ssh_key").mockReturnValue(exampleEcdsaKey);
      platformUtilsService.readFromClipboard.mockResolvedValue("ecdsa_key");
      configService.getFeatureFlag.mockResolvedValue(true);

      expect(await sshImportPromptService.importSshKeyFromClipboard()).not.toBeNull();
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.SSHecdsa);
      expect(logService.error).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(i18nService.t).not.toHaveBeenCalledWith("sshKeyTypeUnsupported");
    });

    it("does not check SSHecdsa flag for non-ECDSA keys", async () => {
      jest.spyOn(sdkInternal, "import_ssh_key").mockReturnValue(exampleSshKey);
      platformUtilsService.readFromClipboard.mockResolvedValue("ssh_key");

      expect(await sshImportPromptService.importSshKeyFromClipboard()).toEqual(exampleSshKeyData);
      expect(configService.getFeatureFlag).not.toHaveBeenCalled();
    });
  });
});
