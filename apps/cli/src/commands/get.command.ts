// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, switchMap } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { CardExport } from "@bitwarden/common/models/export/card.export";
import { CipherExport } from "@bitwarden/common/models/export/cipher.export";
import { CollectionExport } from "@bitwarden/common/models/export/collection.export";
import { FieldExport } from "@bitwarden/common/models/export/field.export";
import { FolderExport } from "@bitwarden/common/models/export/folder.export";
import { IdentityExport } from "@bitwarden/common/models/export/identity.export";
import { LoginUriExport } from "@bitwarden/common/models/export/login-uri.export";
import { LoginExport } from "@bitwarden/common/models/export/login.export";
import { SecureNoteExport } from "@bitwarden/common/models/export/secure-note.export";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationCollectionRequest } from "../admin-console/models/request/organization-collection.request";
import { CollectionResponse } from "../admin-console/models/response/collection.response";
import { OrganizationCollectionResponse } from "../admin-console/models/response/organization-collection.response";
import { OrganizationResponse } from "../admin-console/models/response/organization.response";
import { SelectionReadOnly } from "../admin-console/models/selection-read-only";
import { Response } from "../models/response";
import { StringResponse } from "../models/response/string.response";
import { TemplateResponse } from "../models/response/template.response";
import { CliUtils } from "../utils";
import { CipherResponse } from "../vault/models/cipher.response";
import { FolderResponse } from "../vault/models/folder.response";
import { CliRestrictedItemTypesService } from "../vault/services/cli-restricted-item-types.service";

import { DownloadCommand } from "./download.command";

export class GetCommand extends DownloadCommand {
  constructor(
    private cipherService: CipherService,
    private folderService: FolderService,
    private collectionService: CollectionService,
    private totpService: TotpService,
    private auditService: AuditService,
    private keyService: KeyService,
    encryptService: EncryptService,
    private searchService: SearchService,
    protected apiService: ApiService,
    private organizationService: OrganizationService,
    private eventCollectionService: EventCollectionService,
    private accountProfileService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private cliRestrictedItemTypesService: CliRestrictedItemTypesService,
  ) {
    super(encryptService, apiService);
  }

  async run(object: string, id: string, cmdOptions: Record<string, any>): Promise<Response> {
    if (id != null) {
      id = id.toLowerCase();
    }

    const normalizedOptions = new Options(cmdOptions);
    switch (object.toLowerCase()) {
      case "item":
        return await this.getCipher(id);
      case "username":
        return await this.getUsername(id);
      case "password":
        return await this.getPassword(id);
      case "uri":
        return await this.getUri(id);
      case "totp":
        return await this.getTotp(id);
      case "notes":
        return await this.getNotes(id);
      case "exposed":
        return await this.getExposed(id);
      case "attachment":
        return await this.getAttachment(id, normalizedOptions);
      case "folder":
        return await this.getFolder(id);
      case "collection":
        return await this.getCollection(id);
      case "org-collection":
        return await this.getOrganizationCollection(id, normalizedOptions);
      case "organization":
        return await this.getOrganization(id);
      case "template":
        return await this.getTemplate(id);
      case "fingerprint":
        return await this.getFingerprint(id);
      default:
        return Response.badRequest("Unknown object.");
    }
  }

  private async getCipherView(id: string, userId: UserId): Promise<CipherView | CipherView[]> {
    let decCipher: CipherView = null;

    if (Utils.isGuid(id)) {
      const cipher = await this.cipherService.get(id, userId);
      if (cipher != null) {
        decCipher = await this.cipherService.decrypt(cipher, userId);
      }
    } else if (id.trim() !== "") {
      let ciphers = await this.cipherService.getAllDecrypted(userId);
      ciphers = this.searchService.searchCiphersBasic(ciphers, id);
      if (ciphers.length > 1) {
        return ciphers;
      }
      if (ciphers.length > 0) {
        decCipher = ciphers[0];
      }
    }

    return decCipher;
  }

  private async getCipher(id: string, filter?: (c: CipherView) => boolean) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    let decCipher = await this.getCipherView(id, activeUserId);
    if (decCipher == null) {
      return Response.notFound();
    }

    if (Array.isArray(decCipher)) {
      // Apply restricted ciphers filter
      decCipher = await this.cliRestrictedItemTypesService.filterRestrictedCiphers(decCipher);

      if (decCipher.length === 0) {
        return Response.error("Access to this item type is restricted by organizational policy.");
      }

      if (filter != null) {
        decCipher = decCipher.filter(filter);
      }

      if (decCipher.length === 0) {
        return Response.notFound();
      }

      if (decCipher.length === 1) {
        decCipher = decCipher[0];
      } else {
        return Response.multipleResults(decCipher.map((c) => c.id));
      }
    } else {
      const isCipherRestricted =
        await this.cliRestrictedItemTypesService.isCipherRestricted(decCipher);
      if (isCipherRestricted) {
        return Response.error("Access to this item type is restricted by organizational policy.");
      }

      // Apply filter if provided to single cipher
      if (filter != null && !filter(decCipher)) {
        return Response.notFound();
      }
    }

    await this.eventCollectionService.collect(
      EventType.Cipher_ClientViewed,
      decCipher.id,
      true,
      decCipher.organizationId,
    );

    const res = new CipherResponse(decCipher);
    return Response.success(res);
  }

  private async getUsername(id: string) {
    const cipherResponse = await this.getCipher(
      id,
      (c) => c.type === CipherType.Login && !Utils.isNullOrWhitespace(c.login.username),
    );
    if (!cipherResponse.success) {
      return cipherResponse;
    }

    const cipher = cipherResponse.data as CipherResponse;
    if (cipher.type !== CipherType.Login) {
      return Response.badRequest("Not a login.");
    }

    if (Utils.isNullOrWhitespace(cipher.login.username)) {
      return Response.error("No username available for this login.");
    }

    const res = new StringResponse(cipher.login.username);
    return Response.success(res);
  }

  private async getPassword(id: string) {
    const cipherResponse = await this.getCipher(
      id,
      (c) => c.type === CipherType.Login && !Utils.isNullOrWhitespace(c.login.password),
    );
    if (!cipherResponse.success) {
      return cipherResponse;
    }

    const cipher = cipherResponse.data as CipherResponse;
    if (cipher.type !== CipherType.Login) {
      return Response.badRequest("Not a login.");
    }

    if (Utils.isNullOrWhitespace(cipher.login.password)) {
      return Response.error("No password available for this login.");
    }

    const res = new StringResponse(cipher.login.password);
    return Response.success(res);
  }

  private async getUri(id: string) {
    const cipherResponse = await this.getCipher(
      id,
      (c) =>
        c.type === CipherType.Login &&
        c.login.uris != null &&
        c.login.uris.length > 0 &&
        c.login.uris[0].uri !== "",
    );
    if (!cipherResponse.success) {
      return cipherResponse;
    }

    const cipher = cipherResponse.data as CipherResponse;
    if (cipher.type !== CipherType.Login) {
      return Response.badRequest("Not a login.");
    }

    if (
      cipher.login.uris == null ||
      cipher.login.uris.length === 0 ||
      cipher.login.uris[0].uri === ""
    ) {
      return Response.error("No uri available for this login.");
    }

    const res = new StringResponse(cipher.login.uris[0].uri);
    return Response.success(res);
  }

  private async getTotp(id: string) {
    const cipherResponse = await this.getCipher(
      id,
      (c) => c.type === CipherType.Login && !Utils.isNullOrWhitespace(c.login.totp),
    );
    if (!cipherResponse.success) {
      return cipherResponse;
    }

    const cipher = cipherResponse.data as CipherResponse;
    if (cipher.type !== CipherType.Login) {
      return Response.badRequest("Not a login.");
    }

    if (Utils.isNullOrWhitespace(cipher.login.totp)) {
      return Response.error("No TOTP available for this login.");
    }

    const totpResponse = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
    if (!totpResponse.code) {
      return Response.error("Couldn't generate TOTP code.");
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    const canAccessPremium = await firstValueFrom(
      this.accountProfileService.hasPremiumFromAnySource$(account.id),
    );

    if (!canAccessPremium) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const originalCipher = await this.cipherService.get(cipher.id, activeUserId);
      if (
        originalCipher == null ||
        originalCipher.organizationId == null ||
        !originalCipher.organizationUseTotp
      ) {
        return Response.error("Premium status is required to use this feature.");
      }
    }

    const res = new StringResponse(totpResponse.code);
    return Response.success(res);
  }

  private async getNotes(id: string) {
    const cipherResponse = await this.getCipher(id, (c) => !Utils.isNullOrWhitespace(c.notes));
    if (!cipherResponse.success) {
      return cipherResponse;
    }

    const cipher = cipherResponse.data as CipherResponse;
    if (Utils.isNullOrWhitespace(cipher.notes)) {
      return Response.error("No notes available for this item.");
    }

    const res = new StringResponse(cipher.notes);
    return Response.success(res);
  }

  private async getExposed(id: string) {
    const passwordResponse = await this.getPassword(id);
    if (!passwordResponse.success) {
      return passwordResponse;
    }

    const exposedNumber = await this.auditService.passwordLeaked(
      (passwordResponse.data as StringResponse).data,
    );
    const res = new StringResponse(exposedNumber.toString());
    return Response.success(res);
  }

  private async getAttachment(id: string, options: Options) {
    if (options.itemId == null || options.itemId === "") {
      return Response.badRequest("--itemid <itemid> required.");
    }

    const itemId = options.itemId.toLowerCase();
    const cipherResponse = await this.getCipher(itemId);
    if (!cipherResponse.success) {
      return cipherResponse;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.getCipherView(itemId, activeUserId);
    if (
      cipher == null ||
      Array.isArray(cipher) ||
      cipher.attachments == null ||
      cipher.attachments.length === 0
    ) {
      return Response.error("No attachments available for this item.");
    }

    let attachments = cipher.attachments.filter(
      (a) =>
        a.id.toLowerCase() === id ||
        (a.fileName != null && a.fileName.toLowerCase().indexOf(id) > -1),
    );
    if (attachments.length === 0) {
      return Response.error("Attachment `" + id + "` was not found.");
    }

    const exactMatches = attachments.filter((a) => a.fileName.toLowerCase() === id);
    if (exactMatches.length === 1) {
      attachments = exactMatches;
    }

    if (attachments.length > 1) {
      return Response.multipleResults(attachments.map((a) => a.id));
    }

    const canAccessPremium = await firstValueFrom(
      this.accountProfileService.hasPremiumFromAnySource$(activeUserId),
    );
    if (!canAccessPremium) {
      const originalCipher = await this.cipherService.get(cipher.id, activeUserId);
      if (originalCipher == null || originalCipher.organizationId == null) {
        return Response.error("Premium status is required to use this feature.");
      }
    }

    let url: string;
    try {
      const attachmentDownloadResponse = await this.apiService.getAttachmentData(
        cipher.id,
        attachments[0].id,
      );
      url = attachmentDownloadResponse.url;
    } catch (e) {
      if (e instanceof ErrorResponse && (e as ErrorResponse).statusCode === 404) {
        url = attachments[0].url;
      } else if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }

    const decryptBufferFn = (resp: globalThis.Response) =>
      this.cipherService.getDecryptedAttachmentBuffer(
        cipher.id as CipherId,
        attachments[0],
        resp,
        activeUserId,
      );

    return await this.saveAttachmentToFile(
      url,
      attachments[0].fileName,
      decryptBufferFn,
      options.output,
    );
  }

  private async getFolder(id: string) {
    let decFolder: FolderView = null;
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (Utils.isGuid(id)) {
      const folder = await this.folderService.getFromState(id, activeUserId);
      if (folder != null) {
        decFolder = await folder.decrypt();
      }
    } else if (id.trim() !== "") {
      let folders = await this.folderService.getAllDecryptedFromState(activeUserId);
      folders = CliUtils.searchFolders(folders, id);
      if (folders.length > 1) {
        return Response.multipleResults(folders.map((f) => f.id));
      }
      if (folders.length > 0) {
        decFolder = folders[0];
      }
    }

    if (decFolder == null) {
      return Response.notFound();
    }
    const res = new FolderResponse(decFolder);
    return Response.success(res);
  }

  private async getCollection(id: string) {
    let decCollection: CollectionView = null;
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (Utils.isGuid(id)) {
      const collection = await firstValueFrom(
        this.collectionService.encryptedCollections$(activeUserId).pipe(getById(id)),
      );
      if (collection != null) {
        const orgKeys = await firstValueFrom(this.keyService.activeUserOrgKeys$);
        decCollection = await collection.decrypt(
          orgKeys[collection.organizationId as OrganizationId],
          this.encryptService,
        );
      }
    } else if (id.trim() !== "") {
      let collections = await firstValueFrom(
        this.collectionService.decryptedCollections$(activeUserId),
      );
      collections = CliUtils.searchCollections(collections, id);
      if (collections.length > 1) {
        return Response.multipleResults(collections.map((c) => c.id));
      }
      if (collections.length > 0) {
        decCollection = collections[0];
      }
    }

    if (decCollection == null) {
      return Response.notFound();
    }
    const res = new CollectionResponse(decCollection);
    return Response.success(res);
  }

  private async getOrganizationCollection(id: string, options: Options) {
    if (options.organizationId == null || options.organizationId === "") {
      return Response.badRequest("`organizationid` option is required.");
    }
    if (!Utils.isGuid(id)) {
      return Response.badRequest("`" + id + "` is not a GUID.");
    }
    if (!Utils.isGuid(options.organizationId)) {
      return Response.badRequest("`" + options.organizationId + "` is not a GUID.");
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

      const response = await this.apiService.getCollectionAccessDetails(options.organizationId, id);
      const decCollection = await CollectionView.fromCollectionAccessDetails(
        response,
        this.encryptService,
        orgKey,
      );
      const groups =
        response.groups == null
          ? null
          : response.groups.map(
              (g) => new SelectionReadOnly(g.id, g.readOnly, g.hidePasswords, g.manage),
            );
      const users =
        response.users == null
          ? null
          : response.users.map(
              (g) => new SelectionReadOnly(g.id, g.readOnly, g.hidePasswords, g.manage),
            );
      const res = new OrganizationCollectionResponse(decCollection, groups, users);
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async getOrganization(id: string) {
    let org: Organization = null;
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    if (!userId) {
      return Response.badRequest("No user found.");
    }
    if (Utils.isGuid(id)) {
      org = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(map((organizations) => organizations.find((o) => o.id === id))),
      );
    } else if (id.trim() !== "") {
      let orgs = await firstValueFrom(this.organizationService.organizations$(userId));
      orgs = CliUtils.searchOrganizations(orgs, id);
      if (orgs.length > 1) {
        return Response.multipleResults(orgs.map((c) => c.id));
      }
      if (orgs.length > 0) {
        org = orgs[0];
      }
    }

    if (org == null) {
      return Response.notFound();
    }
    const res = new OrganizationResponse(org);
    return Response.success(res);
  }

  private async getTemplate(id: string) {
    let template: any = null;
    switch (id.toLowerCase()) {
      case "item":
        template = CipherExport.template();
        break;
      case "item.field":
        template = FieldExport.template();
        break;
      case "item.login":
        template = LoginExport.template();
        break;
      case "item.login.uri":
        template = LoginUriExport.template();
        break;
      case "item.card":
        template = CardExport.template();
        break;
      case "item.identity":
        template = IdentityExport.template();
        break;
      case "item.securenote":
        template = SecureNoteExport.template();
        break;
      case "folder":
        template = FolderExport.template();
        break;
      case "collection":
        template = CollectionExport.template();
        break;
      case "item-collections":
        template = ["collection-id1", "collection-id2"];
        break;
      case "org-collection":
        template = OrganizationCollectionRequest.template();
        break;
      case "send.file":
      case "send.text":
        template = Response.badRequest(
          `Invalid template object. Use \`bw send template ${id}\` instead.`,
        );
        break;
      default:
        return Response.badRequest("Unknown template object.");
    }

    const res = new TemplateResponse(template);
    return Response.success(res);
  }

  private async getFingerprint(id: string) {
    let fingerprint: string[] = null;
    if (id === "me") {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const publicKey = await firstValueFrom(this.keyService.userPublicKey$(activeUserId));
      fingerprint = await this.keyService.getFingerprint(activeUserId, publicKey);
    } else if (Utils.isGuid(id)) {
      try {
        const response = await this.apiService.getUserPublicKey(id);
        const pubKey = Utils.fromB64ToArray(response.publicKey);
        fingerprint = await this.keyService.getFingerprint(id, pubKey);
      } catch {
        // empty - handled by the null check below
      }
    }

    if (fingerprint == null) {
      return Response.notFound();
    }
    const res = new StringResponse(fingerprint.join("-"));
    return Response.success(res);
  }
}

class Options {
  itemId: string;
  organizationId: string;
  output: string;

  constructor(passedOptions: Record<string, any>) {
    this.organizationId = passedOptions?.organizationid || passedOptions?.organizationId;
    this.itemId = passedOptions?.itemid || passedOptions?.itemId;
    this.output = passedOptions?.output;
  }
}
