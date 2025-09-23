// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as inquirer from "inquirer";
import { firstValueFrom, map, switchMap } from "rxjs";

import { UpdateCollectionRequest } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CipherExport } from "@bitwarden/common/models/export/cipher.export";
import { CollectionExport } from "@bitwarden/common/models/export/collection.export";
import { FolderExport } from "@bitwarden/common/models/export/folder.export";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationCollectionRequest } from "../admin-console/models/request/organization-collection.request";
import { OrganizationCollectionResponse } from "../admin-console/models/response/organization-collection.response";
import { Response } from "../models/response";
import { CliUtils } from "../utils";
import { CipherResponse } from "../vault/models/cipher.response";
import { FolderResponse } from "../vault/models/folder.response";
import { CliRestrictedItemTypesService } from "../vault/services/cli-restricted-item-types.service";

export class EditCommand {
  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private apiService: ApiService,
    private folderApiService: FolderApiServiceAbstraction,
    private accountService: AccountService,
    private cliRestrictedItemTypesService: CliRestrictedItemTypesService,
    private policyService: PolicyService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async run(
    object: string,
    id: string,
    requestJson: any,
    cmdOptions: Record<string, any>,
  ): Promise<Response> {
    if (process.env.BW_SERVE !== "true" && (requestJson == null || requestJson === "")) {
      requestJson = await CliUtils.readStdin();
    }

    if (requestJson == null || requestJson === "") {
      return Response.badRequest("`requestJson` was not provided.");
    }

    let req: any = null;
    if (typeof requestJson !== "string") {
      req = requestJson;
    } else {
      try {
        const reqJson = Buffer.from(requestJson, "base64").toString();
        req = JSON.parse(reqJson);
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        return Response.badRequest("Error parsing the encoded request data.");
      }
    }

    if (id != null) {
      id = id.toLowerCase();
    }

    const normalizedOptions = new Options(cmdOptions);
    switch (object.toLowerCase()) {
      case "item":
        return await this.editCipher(id, req);
      case "item-collections":
        return await this.editCipherCollections(id, req);
      case "folder":
        return await this.editFolder(id, req);
      case "org-collection":
        return await this.editOrganizationCollection(id, req, normalizedOptions);
      default:
        return Response.badRequest("Unknown object.");
    }
  }

  private async editCipher(id: string, req: CipherExport) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(id, activeUserId);
    const hasPremium = false;

    if (cipher == null) {
      return Response.notFound();
    }

    let cipherView = await this.cipherService.decrypt(cipher, activeUserId);
    if (cipherView.isDeleted) {
      return Response.badRequest("You may not edit a deleted item. Use the restore command first.");
    }
    cipherView = CipherExport.toView(req, cipherView);

    // When a user is editing an archived cipher and does not have premium, automatically unarchive it
    if (cipherView.isArchived && !hasPremium) {
      const acceptedPrompt = await this.promptForArchiveEdit();

      if (!acceptedPrompt) {
        return Response.error("Edit cancelled.");
      }

      cipherView.archivedDate = null;
    }

    const isCipherRestricted =
      await this.cliRestrictedItemTypesService.isCipherRestricted(cipherView);
    if (isCipherRestricted) {
      return Response.error("Editing this item type is restricted by organizational policy.");
    }

    const isPersonalVaultItem = cipherView.organizationId == null;

    const organizationOwnershipPolicyApplies = await firstValueFrom(
      this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, activeUserId),
    );

    if (isPersonalVaultItem && organizationOwnershipPolicyApplies) {
      return Response.error(
        "An organization policy restricts editing this cipher. Please use the share command first before modifying it.",
      );
    }

    const encCipher = await this.cipherService.encrypt(cipherView, activeUserId);
    try {
      const updatedCipher = await this.cipherService.updateWithServer(encCipher);
      const decCipher = await this.cipherService.decrypt(updatedCipher, activeUserId);
      const res = new CipherResponse(decCipher);
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async editCipherCollections(id: string, req: string[]) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const cipher = await this.cipherService.get(id, activeUserId);
    if (cipher == null) {
      return Response.notFound();
    }
    if (cipher.organizationId == null) {
      return Response.badRequest(
        "Item does not belong to an organization. Consider moving it first.",
      );
    }
    if (!cipher.viewPassword) {
      return Response.noEditPermission();
    }

    cipher.collectionIds = req;
    try {
      const updatedCipher = await this.cipherService.saveCollectionsWithServer(
        cipher,
        activeUserId,
      );
      const decCipher = await this.cipherService.decrypt(updatedCipher, activeUserId);
      const res = new CipherResponse(decCipher);
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async editFolder(id: string, req: FolderExport) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const folder = await this.folderService.getFromState(id, activeUserId);
    if (folder == null) {
      return Response.notFound();
    }

    let folderView = await folder.decrypt();
    folderView = FolderExport.toView(req, folderView);

    const userKey = await this.keyService.getUserKey(activeUserId);
    const encFolder = await this.folderService.encrypt(folderView, userKey);
    try {
      const folder = await this.folderApiService.save(encFolder, activeUserId);
      const updatedFolder = new Folder(folder);
      const decFolder = await updatedFolder.decrypt();
      const res = new FolderResponse(decFolder);
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async editOrganizationCollection(
    id: string,
    req: OrganizationCollectionRequest,
    options: Options,
  ) {
    if (options.organizationId == null || options.organizationId === "") {
      return Response.badRequest("`organizationid` option is required.");
    }
    if (!Utils.isGuid(id)) {
      return Response.badRequest("`" + id + "` is not a GUID.");
    }
    if (!Utils.isGuid(options.organizationId)) {
      return Response.badRequest("`" + options.organizationId + "` is not a GUID.");
    }
    if (options.organizationId !== req.organizationId) {
      return Response.badRequest("`organizationid` option does not match request object.");
    }
    try {
      const orgKey = await firstValueFrom(
        this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) => this.keyService.orgKeys$(userId)),
          map((orgKeys) => orgKeys[options.organizationId as OrganizationId] ?? null),
        ),
      );
      if (orgKey == null) {
        throw new Error("No encryption key for this organization.");
      }

      const groups =
        req.groups == null
          ? null
          : req.groups.map(
              (g) => new SelectionReadOnlyRequest(g.id, g.readOnly, g.hidePasswords, g.manage),
            );
      const users =
        req.users == null
          ? null
          : req.users.map(
              (u) => new SelectionReadOnlyRequest(u.id, u.readOnly, u.hidePasswords, u.manage),
            );
      const request = new UpdateCollectionRequest({
        name: await this.encryptService.encryptString(req.name, orgKey),
        externalId: req.externalId,
        users,
        groups,
      });

      const response = await this.apiService.putCollection(req.organizationId, id, request);
      const view = CollectionExport.toView(req, response.id);
      const res = new OrganizationCollectionResponse(view, groups, users);
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  /** Prompt the user to accept movement of their cipher back to the their vault. */
  private async promptForArchiveEdit(): Promise<boolean> {
    // When running in serve or no interaction mode, automatically accept the prompt
    if (process.env.BW_SERVE === "true" || process.env.BW_NOINTERACTION === "true") {
      CliUtils.writeLn(
        "Archive is only available with a Premium subscription, which has ended. Your edit was saved and the item was moved back to your vault.",
      );
      return true;
    }

    const answer: inquirer.Answers = await inquirer.createPromptModule({
      output: process.stderr,
    })({
      type: "list",
      name: "confirm",
      message:
        "When you edit and save details for an archived item without a Premium subscription, it'll be moved from your archive back to your vault.",
      choices: [
        {
          name: "Move now",
          value: "confirmed",
        },
        {
          name: "Cancel",
          value: "cancel",
        },
      ],
    });

    return answer.confirm === "confirmed";
  }
}

class Options {
  organizationId: string;

  constructor(passedOptions: Record<string, any>) {
    this.organizationId = passedOptions?.organizationid || passedOptions?.organizationId;
  }
}
