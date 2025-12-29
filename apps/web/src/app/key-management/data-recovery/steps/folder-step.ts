import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

export class FolderStep implements RecoveryStep {
  title = "recoveryStepFoldersTitle";

  private undecryptableFolderIds: string[] = [];
  private decryptableFolderIds: string[] = [];

  constructor(
    private folderService: FolderApiServiceAbstraction,
    private dialogService: DialogService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    if (!workingData.userKey) {
      logger.record("Missing user key");
      return false;
    }

    this.undecryptableFolderIds = [];
    for (const folder of workingData.folders) {
      if (!folder.name?.encryptedString) {
        logger.record(`Folder ID ${folder.id} has no name`);
        this.undecryptableFolderIds.push(folder.id);
        continue;
      }
      try {
        await SdkLoadService.Ready;
        PureCrypto.symmetric_decrypt_string(
          folder.name.encryptedString,
          workingData.userKey.toEncoded(),
        );
        this.decryptableFolderIds.push(folder.id);
      } catch {
        logger.record(`Folder name for folder ID ${folder.id} was undecryptable`);
        this.undecryptableFolderIds.push(folder.id);
      }
    }
    logger.record(`Found ${this.undecryptableFolderIds.length} undecryptable folders`);
    logger.record(`Found ${this.decryptableFolderIds.length} decryptable folders`);

    return this.undecryptableFolderIds.length == 0;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    // If everything fails to decrypt, it's a deeper issue and we shouldn't offer recovery here.
    return this.undecryptableFolderIds.length > 0 && this.decryptableFolderIds.length > 0;
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    // Recovery means deleting the broken folders.
    if (this.undecryptableFolderIds.length === 0) {
      logger.record("No undecryptable folders to recover");
      return;
    }

    if (!workingData.userId) {
      logger.record("Missing user ID");
      throw new Error("Missing user ID");
    }

    logger.record(`Showing confirmation dialog for ${this.undecryptableFolderIds.length} folders`);

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryDeleteFoldersTitle" },
      content: { key: "recoveryDeleteFoldersDesc" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled folder deletion");
      throw new Error("Folder recovery cancelled by user");
    }

    logger.record(`Deleting ${this.undecryptableFolderIds.length} folders`);

    for (const folderId of this.undecryptableFolderIds) {
      try {
        await this.folderService.delete(folderId, workingData.userId);
        logger.record(`Deleted folder ${folderId}`);
      } catch (error) {
        logger.record(`Failed to delete folder ${folderId}: ${error}`);
      }
    }

    logger.record(`Successfully deleted ${this.undecryptableFolderIds.length} folders`);
  }

  getUndecryptableFolderIds(): string[] {
    return this.undecryptableFolderIds;
  }
}
