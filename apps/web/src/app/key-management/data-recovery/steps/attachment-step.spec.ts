import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Attachment } from "@bitwarden/common/vault/models/domain/attachment";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { AttachmentStep } from "./attachment-step";
import { RecoveryWorkingData } from "./recovery-step";

describe("AttachmentStep", () => {
  let attachmentStep: AttachmentStep;
  let i18nService: MockProxy<I18nService>;
  let logger: MockProxy<LogRecorder>;

  const userId = "user-id" as UserId;
  const issueMessage = "recoveryStepAttachmentIssue-used-i18n";

  function attachment(id: string, key: EncString | undefined): Attachment {
    return { id, key } as Attachment;
  }

  function cipher(id: string, organizationId: string | null, attachments?: Attachment[]): Cipher {
    return { id, organizationId, attachments } as Cipher;
  }

  function workingDataWith(ciphers: Cipher[]): RecoveryWorkingData {
    return {
      userId,
      userKey: null,
      isPrivateKeyCorrupt: false,
      ciphers,
      folders: [],
    };
  }

  beforeEach(() => {
    i18nService = mock<I18nService>();
    logger = mock<LogRecorder>();

    i18nService.t.mockReturnValue(issueMessage);

    attachmentStep = new AttachmentStep(i18nService);
  });

  describe("runDiagnostics", () => {
    it("returns true and sets no message when no cipher has attachments", async () => {
      const workingData = workingDataWith([cipher("cipher-1", null), cipher("cipher-2", null)]);

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(attachmentStep.message).toBeUndefined();
      expect(logger.record).toHaveBeenCalledWith("Found 0 ciphers with old attachments");
    });

    it("returns true when every attachment has a key", async () => {
      const withKey = attachment("attachment-1", new EncString("2.encrypted-key"));
      const workingData = workingDataWith([cipher("cipher-1", null, [withKey])]);

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(attachmentStep.message).toBeUndefined();
      expect(logger.record).toHaveBeenCalledWith("Found 0 ciphers with old attachments");
    });

    it("returns true when only an organization cipher has an old attachment", async () => {
      const oldAttachment = attachment("attachment-1", undefined);
      const workingData = workingDataWith([cipher("org-cipher", "org-id", [oldAttachment])]);

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(logger.record).toHaveBeenCalledWith("Found 0 ciphers with old attachments");
    });

    it("returns false and logs the cipher id when a user cipher has an attachment without a key", async () => {
      const oldAttachment = attachment("attachment-1", undefined);
      const workingData = workingDataWith([cipher("cipher-1", null, [oldAttachment])]);

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Cipher ID cipher-1 has old attachments");
      expect(logger.record).toHaveBeenCalledWith("Found 1 ciphers with old attachments");
    });

    it("sets a localized message with the number of affected ciphers", async () => {
      const oldAttachment = attachment("attachment-1", undefined);
      const workingData = workingDataWith([
        cipher("cipher-1", null, [oldAttachment]),
        cipher("cipher-2", null, [oldAttachment]),
      ]);

      await attachmentStep.runDiagnostics(workingData, logger);

      expect(i18nService.t).toHaveBeenCalledWith("recoveryStepAttachmentIssue", "2");
      expect(attachmentStep.message).toBe(issueMessage);
    });

    it("logs one line per affected cipher and ignores ciphers that are not affected", async () => {
      const oldAttachment = attachment("attachment-1", undefined);
      const anotherOldAttachment = attachment("attachment-2", undefined);
      const withKey = attachment("attachment-3", new EncString("2.encrypted-key"));
      const workingData = workingDataWith([
        cipher("cipher-1", null, [oldAttachment, withKey]),
        cipher("cipher-2", null, [withKey]),
        cipher("cipher-3", null, [oldAttachment, anotherOldAttachment]),
        cipher("org-cipher", "org-id", [oldAttachment]),
      ]);

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Cipher ID cipher-1 has old attachments");
      expect(logger.record).toHaveBeenCalledWith("Cipher ID cipher-3 has old attachments");
      expect(logger.record).not.toHaveBeenCalledWith(expect.stringContaining("Cipher ID cipher-2"));
      expect(logger.record).not.toHaveBeenCalledWith(
        expect.stringContaining("Cipher ID org-cipher"),
      );
      expect(logger.record).toHaveBeenCalledWith("Found 2 ciphers with old attachments");
    });

    it("clears the results of a previous run", async () => {
      const oldAttachment = attachment("attachment-1", undefined);
      await attachmentStep.runDiagnostics(
        workingDataWith([cipher("cipher-1", null, [oldAttachment])]),
        logger,
      );

      const result = await attachmentStep.runDiagnostics(
        workingDataWith([cipher("cipher-1", null)]),
        logger,
      );

      expect(result).toBe(true);
      expect(attachmentStep.message).toBeUndefined();
      expect(attachmentStep.oldAttachmentCipherIds).toEqual([]);
      expect(logger.record).toHaveBeenLastCalledWith("Found 0 ciphers with old attachments");
    });
  });

  describe("canRecover", () => {
    it("returns false when old attachments were found", async () => {
      const oldAttachment = attachment("attachment-1", undefined);
      const workingData = workingDataWith([cipher("cipher-1", null, [oldAttachment])]);
      await attachmentStep.runDiagnostics(workingData, logger);

      expect(attachmentStep.canRecover(workingData)).toBe(false);
    });
  });

  describe("runRecovery", () => {
    it("does nothing", async () => {
      const workingData = workingDataWith([]);

      await attachmentStep.runRecovery(workingData, logger);

      expect(logger.record).not.toHaveBeenCalled();
    });
  });
});
