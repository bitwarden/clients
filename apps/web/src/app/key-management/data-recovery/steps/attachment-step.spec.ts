import { mock, MockProxy } from "jest-mock-extended";
import { EmptyError } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherSdkService } from "@bitwarden/common/vault/abstractions/cipher-sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherPermissionsApi } from "@bitwarden/common/vault/models/api/cipher-permissions.api";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { isCipherGetAttachmentDownloadUrlError } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { AttachmentStep } from "./attachment-step";
import { RecoveryWorkingData } from "./recovery-step";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  isCipherGetAttachmentDownloadUrlError: jest.fn().mockReturnValue(false),
}));

const userId = "user-id" as UserId;

type AttachmentOptions = {
  legacy?: boolean;
  nameOrKeyError?: boolean;
  /** For attachments with a broken name or key: whether the contents still decrypt (name only). */
  readable?: boolean;
};

/** IDs of attachments where only the file name is broken, so the contents still decrypt. */
const readableIds = new Set<string>();

function attachment(id: string, options: AttachmentOptions = {}): AttachmentView {
  if (options.readable) {
    readableIds.add(id);
  }
  return {
    id,
    url: `https://storage/${id}`,
    key: options.legacy ? undefined : {},
    hasDecryptionError: options.nameOrKeyError ?? false,
  } as unknown as AttachmentView;
}

type Item = { cipher: Cipher; view: CipherView };

function personalItem(id: string, attachments: AttachmentView[]): Item {
  return {
    cipher: { id, organizationId: null, edit: true } as unknown as Cipher,
    view: { id, attachments } as unknown as CipherView,
  };
}

function orgItem(
  id: string,
  attachments: AttachmentView[],
  { edit = true, canDelete = true }: { edit?: boolean; canDelete?: boolean } = {},
): Item {
  const permissions = new CipherPermissionsApi();
  permissions.delete = canDelete;
  return {
    cipher: { id, organizationId: "org-id", edit, permissions } as unknown as Cipher,
    view: { id, attachments } as unknown as CipherView,
  };
}

function workingDataWith(items: Item[], undecryptable: Cipher[] = []): RecoveryWorkingData {
  return {
    userId,
    userKey: null,
    isPrivateKeyCorrupt: false,
    ciphers: [...items.map((i) => i.cipher), ...undecryptable],
    decryptedCiphers: items.map((i) => i.view),
    folders: [],
  };
}

describe("AttachmentStep", () => {
  let step: AttachmentStep;
  let cipherService: MockProxy<CipherService>;
  let cipherSdkService: MockProxy<CipherSdkService>;
  let cipherEncryptionService: MockProxy<CipherEncryptionService>;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let logger: MockProxy<LogRecorder>;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  /** Attachment IDs whose downloaded contents fail to decrypt. */
  let undecryptableIds: Set<string>;
  /** Attachment IDs whose download returns this HTTP status. */
  let downloadStatus: Map<string, number>;

  const logLines = () => logger.record.mock.calls.map(([line]) => line);

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherSdkService = mock<CipherSdkService>();
    cipherEncryptionService = mock<CipherEncryptionService>();
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    logger = mock<LogRecorder>();

    undecryptableIds = new Set();
    readableIds.clear();
    downloadStatus = new Map();

    i18nService.t.mockImplementation((key: string, ...args: unknown[]) => [key, ...args].join(":"));
    cipherSdkService.getAttachmentDownloadUrl.mockImplementation(
      async (_cipherId, attachmentId) => `https://download/${attachmentId}`,
    );
    fetchMock = jest.fn(async (url: string) => {
      const id = url.split("/").pop()!;
      return {
        status: downloadStatus.get(id) ?? 200,
        arrayBuffer: async () => new ArrayBuffer(4),
      };
    });
    global.fetch = fetchMock;
    cipherEncryptionService.decryptAttachmentContent.mockImplementation(
      async (_cipher, attachment) => {
        const keyBroken = attachment.hasDecryptionError && !readableIds.has(attachment.id!);
        if (undecryptableIds.has(attachment.id!) || keyBroken) {
          // The real service swallows the SDK error and completes empty.
          throw new EmptyError();
        }
        return new Uint8Array([1, 2, 3]);
      },
    );
    dialogService.openSimpleDialog.mockResolvedValue(true);

    step = new AttachmentStep(
      cipherService,
      cipherSdkService,
      cipherEncryptionService,
      dialogService,
      i18nService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("runDiagnostics", () => {
    it("fails without checking anything when the cipher step couldn't decrypt", async () => {
      const result = await step.runDiagnostics(
        {
          ...workingDataWith([personalItem("cipher-1", [attachment("a1")])]),
          decryptedCiphers: null,
        },
        logger,
      );

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(step.message).toBe("recoveryAttachmentsNotChecked");
      expect(step.canRecover(workingDataWith([]))).toBe(false);
    });

    it("doesn't treat a failed decryption of a very large file as unrecoverable", async () => {
      undecryptableIds.add("a1");
      const big = { ...attachment("a1"), size: String(200 * 1024 * 1024) } as AttachmentView;
      const workingData = workingDataWith([personalItem("cipher-1", [big])]);

      const result = await step.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(step.message).toBe("recoveryAttachmentsUnchecked:1");
      expect(step.canRecover(workingData)).toBe(false);
    });

    it("returns false when the user ID is missing", async () => {
      const result = await step.runDiagnostics({ ...workingDataWith([]), userId: null }, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Missing user ID");
    });

    it("passes when every attachment has its own key and decrypts", async () => {
      const item = personalItem("cipher-1", [attachment("a1"), attachment("a2")]);

      const result = await step.runDiagnostics(workingDataWith([item]), logger);

      expect(result).toBe(true);
      expect(step.message).toBeUndefined();
      expect(step.canRecover(workingDataWith([item]))).toBe(false);
      expect(cipherEncryptionService.decryptAttachmentContent).toHaveBeenCalledTimes(2);
    });

    it("decrypts contents against the encrypted cipher with the downloaded bytes", async () => {
      const a1 = attachment("a1");
      const item = personalItem("cipher-1", [a1]);

      await step.runDiagnostics(workingDataWith([item]), logger);

      expect(cipherSdkService.getAttachmentDownloadUrl).toHaveBeenCalledWith(
        "cipher-1",
        "a1",
        userId,
      );
      expect(fetchMock).toHaveBeenCalledWith("https://download/a1", { cache: "no-store" });
      expect(cipherEncryptionService.decryptAttachmentContent).toHaveBeenCalledWith(
        item.cipher,
        a1,
        expect.any(Uint8Array),
        userId,
      );
    });

    it("flags attachments whose name or key and contents are all undecryptable as unrecoverable", async () => {
      const item = personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true })]);

      const result = await step.runDiagnostics(workingDataWith([item]), logger);

      expect(result).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(step.message).toBe("recoveryAttachmentsUnrecoverable:1");
      expect(logLines()).toContain(
        "Attachment a1 on cipher cipher-1 (personal) has an undecryptable file name or key",
      );
    });

    it("flags attachments with a lost file name but readable contents for re-saving", async () => {
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true, readable: true })]),
      ]);

      const result = await step.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(step.message).toBe("recoveryAttachmentsNameLost:1");
      expect(step.canRecover(workingData)).toBe(true);
      expect(logLines()).toContain(
        "Attachment a1 on cipher cipher-1 (personal) has readable contents and can be renamed",
      );
    });

    it("reports a lost-name attachment it can't download, without offering anything", async () => {
      downloadStatus.set("a1", 503);
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true })]),
      ]);

      const result = await step.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(step.message).toBe("recoveryAttachmentsUnchecked:1");
      expect(step.canRecover(workingData)).toBe(false);
    });

    it("flags attachments whose contents fail to decrypt", async () => {
      undecryptableIds.add("a1");
      const item = personalItem("cipher-1", [attachment("a1")]);

      const result = await step.runDiagnostics(workingDataWith([item]), logger);

      expect(result).toBe(false);
      expect(step.message).toBe("recoveryAttachmentsUnrecoverable:1");
      expect(logLines()).toContainEqual(
        expect.stringContaining(
          "Attachment a1 on cipher cipher-1 (personal) has undecryptable contents",
        ),
      );
    });

    it("flags legacy attachments whose contents decrypt as upgradable", async () => {
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { legacy: true })]),
      ]);

      const result = await step.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(step.message).toBe("recoveryAttachmentsOldEncryption:1");
      expect(step.canRecover(workingData)).toBe(true);
    });

    it("treats a legacy attachment with undecryptable contents as unrecoverable, not upgradable", async () => {
      undecryptableIds.add("a1");
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { legacy: true })]),
      ]);

      await step.runDiagnostics(workingData, logger);

      expect(step.message).toBe("recoveryAttachmentsUnrecoverable:1");
    });

    it.each([
      ["a non-200 response", () => downloadStatus.set("a1", 404), "HTTP 404"],
      [
        "a network error",
        () => fetchMock.mockRejectedValueOnce(new Error("network down")),
        "network down",
      ],
      [
        "a failed download URL lookup",
        () => cipherSdkService.getAttachmentDownloadUrl.mockRejectedValueOnce(new Error("500")),
        "download URL could not be fetched",
      ],
    ])(
      "reports attachments it can't download after %s, without failing",
      async (_, arrange, logged) => {
        arrange();
        const workingData = workingDataWith([personalItem("cipher-1", [attachment("a1")])]);

        const result = await step.runDiagnostics(workingData, logger);

        expect(result).toBe(true);
        expect(step.message).toBe("recoveryAttachmentsUnchecked:1");
        expect(step.canRecover(workingData)).toBe(false);
        expect(logLines()).toContainEqual(expect.stringContaining(logged));
        expect(cipherEncryptionService.decryptAttachmentContent).not.toHaveBeenCalled();
      },
    );

    it("falls back to the stored URL when the download endpoint reports NotFound", async () => {
      jest.mocked(isCipherGetAttachmentDownloadUrlError).mockReturnValueOnce(true);
      cipherSdkService.getAttachmentDownloadUrl.mockRejectedValueOnce({ variant: "NotFound" });
      const workingData = workingDataWith([personalItem("cipher-1", [attachment("a1")])]);

      const result = await step.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith("https://storage/a1", { cache: "no-store" });
    });

    it("only checks attachments of items that decrypted", async () => {
      // With strict decryption, an item with any bad field fails as a whole and is handled by
      // the cipher step; it is not in decryptedCiphers, so its attachments are not checked.
      const healthy = personalItem("cipher-1", [attachment("a1")]);
      const undecryptable = { id: "cipher-2", organizationId: null } as unknown as Cipher;

      await step.runDiagnostics(workingDataWith([healthy], [undecryptable]), logger);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(logLines()).toContain("Checking 1 attachments");
    });

    describe("organization items", () => {
      it("can repair attachments when the user has edit and delete permission", async () => {
        const workingData = workingDataWith([
          orgItem("org-1", [attachment("a1", { nameOrKeyError: true })]),
          orgItem("org-2", [attachment("a2", { legacy: true })]),
        ]);

        await step.runDiagnostics(workingData, logger);

        expect(step.canRecover(workingData)).toBe(true);
      });

      it.each([
        ["without edit access", { edit: false, canDelete: true }],
        ["without delete permission", { edit: true, canDelete: false }],
      ])(
        "tells the user to contact support for unrecoverable attachments %s",
        async (_, access) => {
          const workingData = workingDataWith([
            orgItem("org-1", [attachment("a1", { nameOrKeyError: true })], access),
          ]);

          const result = await step.runDiagnostics(workingData, logger);

          expect(result).toBe(false);
          expect(step.canRecover(workingData)).toBe(false);
          expect(step.message).toBe(
            "recoveryAttachmentsUnrecoverable:1 recoveryOrgAttachmentsContactSupport:1",
          );
        },
      );

      it("renames lost-name attachments with edit access, even without delete permission", async () => {
        const workingData = workingDataWith([
          orgItem("org-1", [attachment("a1", { nameOrKeyError: true, readable: true })], {
            canDelete: false,
          }),
        ]);

        await step.runDiagnostics(workingData, logger);

        expect(step.canRecover(workingData)).toBe(true);
      });

      it("tells the user to contact support for lost-name attachments without edit access", async () => {
        const workingData = workingDataWith([
          orgItem("org-1", [attachment("a1", { nameOrKeyError: true, readable: true })], {
            edit: false,
          }),
        ]);

        await step.runDiagnostics(workingData, logger);

        expect(step.canRecover(workingData)).toBe(false);
        expect(step.message).toBe(
          "recoveryAttachmentsNameLost:1 recoveryOrgAttachmentsContactSupport:1",
        );
      });

      it("doesn't upgrade legacy attachments without delete permission", async () => {
        // Upgrading deletes the old attachment, which the server refuses without delete
        // permission; the upgrade would leave a duplicate behind on every repair.
        const workingData = workingDataWith([
          orgItem("org-1", [attachment("a1", { legacy: true })], { canDelete: false }),
        ]);

        await step.runDiagnostics(workingData, logger);
        await step.runRecovery(workingData, logger);

        expect(step.canRecover(workingData)).toBe(false);
        expect(cipherService.upgradeOldCipherAttachments).not.toHaveBeenCalled();
        expect(step.message).toBe(
          "recoveryAttachmentsOldEncryption:1 recoveryOrgAttachmentsContactSupport:1",
        );
      });

      it("tells the user to contact support for legacy attachments without edit access", async () => {
        const workingData = workingDataWith([
          orgItem("org-1", [attachment("a1", { legacy: true })], { edit: false }),
        ]);

        await step.runDiagnostics(workingData, logger);

        expect(step.canRecover(workingData)).toBe(false);
        expect(step.message).toBe(
          "recoveryAttachmentsOldEncryption:1 recoveryOrgAttachmentsContactSupport:1",
        );
      });
    });

    it("clears the results of a previous run", async () => {
      await step.runDiagnostics(
        workingDataWith([personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true })])]),
        logger,
      );

      const result = await step.runDiagnostics(
        workingDataWith([personalItem("cipher-1", [])]),
        logger,
      );

      expect(result).toBe(true);
      expect(step.message).toBeUndefined();
    });
  });

  describe("runRecovery", () => {
    describe("lost-name attachments", () => {
      let item: Item;
      let workingData: RecoveryWorkingData;

      /** The item view the step saved. */
      const savedView = () => cipherService.updateWithServer.mock.calls[0][0];

      beforeEach(async () => {
        item = personalItem("cipher-1", [
          attachment("a1", { nameOrKeyError: true, readable: true }),
        ]);
        workingData = workingDataWith([item]);
        cipherService.get.mockResolvedValue(item.cipher);
        // The item as it is now, decrypted again before the rename.
        cipherEncryptionService.decrypt.mockImplementation(
          async () =>
            ({
              id: "cipher-1",
              attachments: [attachment("a1", { nameOrKeyError: true, readable: true })],
            }) as unknown as CipherView,
        );
        await step.runDiagnostics(workingData, logger);
        fetchMock.mockClear();
      });

      it("renames the attachment in place by saving the item, without asking", async () => {
        await step.runRecovery(workingData, logger);

        expect(cipherService.get).toHaveBeenCalledWith("cipher-1", userId);
        expect(cipherService.updateWithServer).toHaveBeenCalledTimes(1);
        expect(cipherService.updateWithServer).toHaveBeenCalledWith(expect.anything(), userId);
        expect(savedView().attachments[0].id).toBe("a1");
        expect(savedView().attachments[0].fileName).toBe("recoveredAttachmentFileName:a1");
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        // The file is never downloaded, uploaded or deleted.
        expect(fetchMock).not.toHaveBeenCalled();
        expect(cipherService.saveAttachmentRawWithServer).not.toHaveBeenCalled();
        expect(cipherService.deleteAttachmentWithServer).not.toHaveBeenCalled();
        expect(logLines()).toContain("Attachment a1 on cipher cipher-1 (personal) was renamed");
      });

      it("skips an attachment an earlier repair already renamed", async () => {
        cipherEncryptionService.decrypt.mockResolvedValue({
          id: "cipher-1",
          attachments: [{ id: "a1", fileName: "recovered", hasDecryptionError: false }],
        } as unknown as CipherView);

        await step.runRecovery(workingData, logger);

        expect(cipherService.updateWithServer).not.toHaveBeenCalled();
        expect(logLines()).toContain(
          "Attachment a1 on cipher cipher-1 (personal) was already renamed",
        );
      });

      it("skips an attachment that was already removed", async () => {
        cipherEncryptionService.decrypt.mockResolvedValue({
          id: "cipher-1",
          attachments: [],
        } as unknown as CipherView);

        await step.runRecovery(workingData, logger);

        expect(cipherService.updateWithServer).not.toHaveBeenCalled();
        expect(logLines()).toContain(
          "Attachment a1 on cipher cipher-1 (personal) was already removed",
        );
      });

      it("reports a failed save and deletes nothing", async () => {
        cipherService.updateWithServer.mockRejectedValue(new Error("conflict"));

        await expect(step.runRecovery(workingData, logger)).rejects.toThrow(
          "0 upgrades, 1 renames and 0 deletions failed",
        );

        expect(cipherService.deleteAttachmentWithServer).not.toHaveBeenCalled();
        expect(logLines()).toContain(
          "Attachment a1 on cipher cipher-1 (personal) could not be renamed or upgraded: conflict",
        );
      });

      it("reports when the item can't be read again, without saving", async () => {
        cipherEncryptionService.decrypt.mockRejectedValue(new Error("decrypt failed"));

        await expect(step.runRecovery(workingData, logger)).rejects.toThrow("1 renames");

        expect(cipherService.updateWithServer).not.toHaveBeenCalled();
      });
    });

    describe("legacy lost-name attachments", () => {
      const legacyLostName = () =>
        attachment("a1", { legacy: true, nameOrKeyError: true, readable: true });
      const renamedView = { id: "cipher-1", attachments: [] } as unknown as CipherView;

      async function repair(item: Item) {
        const workingData = workingDataWith([item]);
        cipherService.get.mockResolvedValue(item.cipher);
        cipherEncryptionService.decrypt.mockImplementation(
          async () =>
            ({ id: item.cipher.id, attachments: [legacyLostName()] }) as unknown as CipherView,
        );
        cipherService.updateWithServer.mockResolvedValue(renamedView);
        await step.runDiagnostics(workingData, logger);
        return step.runRecovery(workingData, logger);
      }

      it("upgrades a legacy attachment right after renaming it, using the saved item", async () => {
        await repair(personalItem("cipher-1", [legacyLostName()]));

        expect(cipherService.upgradeOldCipherAttachments).toHaveBeenCalledWith(
          renamedView,
          userId,
          "a1",
        );
        expect(cipherService.updateWithServer.mock.invocationCallOrder[0]).toBeLessThan(
          cipherService.upgradeOldCipherAttachments.mock.invocationCallOrder[0],
        );
      });

      it("only renames it when the user may not upgrade", async () => {
        await repair(orgItem("org-1", [legacyLostName()], { canDelete: false }));

        expect(cipherService.updateWithServer).toHaveBeenCalledTimes(1);
        expect(cipherService.upgradeOldCipherAttachments).not.toHaveBeenCalled();
      });

      it("reports a failed upgrade after the rename, and deletes nothing", async () => {
        cipherService.upgradeOldCipherAttachments.mockRejectedValue(new Error("upload failed"));

        await expect(repair(personalItem("cipher-1", [legacyLostName()]))).rejects.toThrow(
          "1 renames",
        );

        expect(cipherService.deleteAttachmentWithServer).not.toHaveBeenCalled();
      });
    });

    it("renames each lost-name attachment on one item, re-reading the item before each", async () => {
      const item = personalItem("cipher-1", [
        attachment("a1", { nameOrKeyError: true, readable: true }),
        attachment("a2", { nameOrKeyError: true, readable: true }),
      ]);
      const workingData = workingDataWith([item]);
      cipherService.get.mockResolvedValue(item.cipher);
      cipherEncryptionService.decrypt.mockImplementation(
        async () =>
          ({
            id: "cipher-1",
            attachments: [
              attachment("a1", { nameOrKeyError: true, readable: true }),
              attachment("a2", { nameOrKeyError: true, readable: true }),
            ],
          }) as unknown as CipherView,
      );
      await step.runDiagnostics(workingData, logger);

      await step.runRecovery(workingData, logger);

      // Each save changes the item's revision date, so it is read again every time.
      expect(cipherService.get).toHaveBeenCalledTimes(2);
      const renamed = cipherService.updateWithServer.mock.calls.map(
        ([view], i) => view.attachments.find((a) => a.id === `a${i + 1}`)?.fileName,
      );
      expect(renamed).toEqual(["recoveredAttachmentFileName:a1", "recoveredAttachmentFileName:a2"]);
    });

    it("upgrades legacy attachments without asking", async () => {
      const item = personalItem("cipher-1", [attachment("a1", { legacy: true })]);
      const workingData = workingDataWith([item]);
      await step.runDiagnostics(workingData, logger);

      await step.runRecovery(workingData, logger);

      expect(cipherService.upgradeOldCipherAttachments).toHaveBeenCalledWith(
        item.view,
        userId,
        "a1",
      );
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(cipherService.deleteAttachmentWithServer).not.toHaveBeenCalled();
    });

    it("reports a failed upgrade and never deletes the attachment", async () => {
      cipherService.upgradeOldCipherAttachments.mockRejectedValue(new Error("upload failed"));
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { legacy: true })]),
      ]);
      await step.runDiagnostics(workingData, logger);

      await expect(step.runRecovery(workingData, logger)).rejects.toThrow(
        "1 upgrades, 0 renames and 0 deletions failed",
      );

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(cipherService.deleteAttachmentWithServer).not.toHaveBeenCalled();
      expect(logLines()).toContain(
        "Attachment a1 on cipher cipher-1 (personal) could not be upgraded: upload failed",
      );
    });

    it("deletes unrecoverable attachments after confirmation", async () => {
      undecryptableIds.add("a2");
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true })]),
        orgItem("org-1", [attachment("a2")]),
      ]);
      await step.runDiagnostics(workingData, logger);

      await step.runRecovery(workingData, logger);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "recoveryDeleteAttachmentsCountDesc", placeholders: [2] },
          type: "danger",
        }),
      );
      expect(cipherService.deleteAttachmentWithServer).toHaveBeenCalledWith(
        "cipher-1",
        "a1",
        userId,
        false,
      );
      expect(cipherService.deleteAttachmentWithServer).toHaveBeenCalledWith(
        "org-1",
        "a2",
        userId,
        false,
      );
    });

    it("mentions unrecoverable organization attachments it can't delete in the dialog", async () => {
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true })]),
        orgItem("org-1", [attachment("a2", { nameOrKeyError: true })], { canDelete: false }),
      ]);
      await step.runDiagnostics(workingData, logger);

      await step.runRecovery(workingData, logger);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "recoveryDeleteAttachmentsWithUndeletableDesc", placeholders: [1, 1] },
        }),
      );
      expect(cipherService.deleteAttachmentWithServer).toHaveBeenCalledTimes(1);
    });

    it("never deletes attachments that couldn't be downloaded", async () => {
      downloadStatus.set("a2", 503);
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true }), attachment("a2")]),
      ]);
      await step.runDiagnostics(workingData, logger);

      await step.runRecovery(workingData, logger);

      expect(cipherService.deleteAttachmentWithServer).toHaveBeenCalledTimes(1);
      expect(cipherService.deleteAttachmentWithServer).toHaveBeenCalledWith(
        "cipher-1",
        "a1",
        userId,
        false,
      );
    });

    it("throws without deleting when the user cancels", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const workingData = workingDataWith([
        personalItem("cipher-1", [attachment("a1", { nameOrKeyError: true })]),
      ]);
      await step.runDiagnostics(workingData, logger);

      await expect(step.runRecovery(workingData, logger)).rejects.toThrow(
        "Attachment recovery cancelled by user",
      );
      expect(cipherService.deleteAttachmentWithServer).not.toHaveBeenCalled();
    });

    it("attempts every deletion and throws if any failed", async () => {
      cipherService.deleteAttachmentWithServer.mockRejectedValueOnce(new Error("server error"));
      const workingData = workingDataWith([
        personalItem("cipher-1", [
          attachment("a1", { nameOrKeyError: true }),
          attachment("a2", { nameOrKeyError: true }),
        ]),
      ]);
      await step.runDiagnostics(workingData, logger);

      await expect(step.runRecovery(workingData, logger)).rejects.toThrow(
        "0 upgrades, 0 renames and 1 deletions failed",
      );
      expect(cipherService.deleteAttachmentWithServer).toHaveBeenCalledTimes(2);
    });
  });
});
