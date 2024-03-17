import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";

import { Response } from "../models/response";
import { CliUtils } from "../utils";

export class DeleteCommand {
  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private apiService: ApiService,
    private folderApiService: FolderApiServiceAbstraction,
    private accountProfileService: BillingAccountProfileStateService,
  ) {}

  async run(object: string, id: string, cmdOptions: Record<string, any>): Promise<Response> {
    if (id != null) {
      id = id.toLowerCase();
    }

    const normalizedOptions = new Options(cmdOptions);
    switch (object.toLowerCase()) {
      case "item":
        return await this.deleteCipher(id, normalizedOptions);
      case "attachment":
        return await this.deleteAttachment(id, normalizedOptions);
      case "folder":
        return await this.deleteFolder(id);
      case "org-collection":
        return await this.deleteOrganizationCollection(id, normalizedOptions);
      default:
        return Response.badRequest("Unknown object.");
    }
  }

  private async deleteCipher(id: string, options: Options) {
    const cipher = await this.cipherService.get(id);
    if (cipher == null) {
      return Response.notFound();
    }

    try {
      if (options.permanent) {
        await this.cipherService.deleteWithServer(id);
      } else {
        await this.cipherService.softDeleteWithServer(id);
      }
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  private async deleteAttachment(id: string, options: Options) {
    if (options.itemId == null || options.itemId === "") {
      return Response.badRequest("`itemid` option is required.");
    }

    const itemId = options.itemId.toLowerCase();
    const cipher = await this.cipherService.get(itemId);
    if (cipher == null) {
      return Response.notFound();
    }

    if (cipher.attachments == null || cipher.attachments.length === 0) {
      return Response.error("No attachments available for this item.");
    }

    const attachments = cipher.attachments.filter((a) => a.id.toLowerCase() === id);
    if (attachments.length === 0) {
      return Response.error("Attachment `" + id + "` was not found.");
    }

    const canAccessPremium = await firstValueFrom(
      this.accountProfileService.hasPremiumFromAnySource$,
    );
    if (cipher.organizationId == null && !canAccessPremium) {
      return Response.error("Premium status is required to use this feature.");
    }

    try {
      await this.cipherService.deleteAttachmentWithServer(cipher.id, attachments[0].id);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  private async deleteFolder(id: string) {
    const folder = await this.folderService.getFromState(id);
    if (folder == null) {
      return Response.notFound();
    }

    try {
      await this.folderApiService.delete(id);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  private async deleteOrganizationCollection(id: string, options: Options) {
    if (options.organizationId == null || options.organizationId === "") {
      return Response.badRequest("`organizationid` options is required.");
    }
    if (!Utils.isGuid(id)) {
      return Response.badRequest("`" + id + "` is not a GUID.");
    }
    if (!Utils.isGuid(options.organizationId)) {
      return Response.badRequest("`" + options.organizationId + "` is not a GUID.");
    }
    try {
      await this.apiService.deleteCollection(options.organizationId, id);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }
}

class Options {
  itemId: string;
  organizationId: string;
  permanent: boolean;

  constructor(passedOptions: Record<string, any>) {
    this.organizationId = passedOptions?.organizationid || passedOptions?.organizationId;
    this.itemId = passedOptions?.itemid || passedOptions?.itemId;
    this.permanent = CliUtils.convertBooleanOption(passedOptions?.permanent);
  }
}
