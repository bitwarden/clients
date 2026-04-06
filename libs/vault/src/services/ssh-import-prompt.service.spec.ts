import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

  beforeEach(() => {
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    platformUtilsService = mock<PlatformUtilsService>();
    i18nService = mock<I18nService>();

    sshImportPromptService = new DefaultSshImportPromptService(
      dialogService,
      toastService,
      platformUtilsService,
      i18nService,
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
  });
});
