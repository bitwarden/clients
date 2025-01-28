// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  OrganizationUserApiService,
  OrganizationUserConfirmRequest,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { KeyService } from "@bitwarden/key-management";

import { Response } from "../../models/response";

export class ConfirmCommand {
  constructor(
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private organizationUserApiService: OrganizationUserApiService,
  ) {}

  async run(object: string, id: string, cmdOptions: Record<string, any>): Promise<Response> {
    if (id != null) {
      id = id.toLowerCase();
    }

    const normalizedOptions = new Options(cmdOptions);
    switch (object.toLowerCase()) {
      case "org-member":
        return await this.confirmOrganizationMember(id, normalizedOptions);
      default:
        return Response.badRequest("Unknown object.");
    }
  }

  private async confirmOrganizationMember(id: string, options: Options) {
    if (options.organizationId == null || options.organizationId === "") {
      return Response.badRequest("--organizationid <organizationid> required.");
    }
    if (!Utils.isGuid(id)) {
      return Response.badRequest("`" + id + "` is not a GUID.");
    }
    if (!Utils.isGuid(options.organizationId)) {
      return Response.badRequest("`" + options.organizationId + "` is not a GUID.");
    }
    try {
      const orgKey = await this.keyService.getOrgKey(options.organizationId);
      if (orgKey == null) {
        throw new Error("No encryption key for this organization.");
      }
      const orgUser = await this.organizationUserApiService.getOrganizationUser(
        options.organizationId,
        id,
      );
      if (orgUser == null) {
        throw new Error("Member id does not exist for this organization.");
      }
      const publicKeyResponse = await this.apiService.getUserPublicKey(orgUser.userId);
      const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);
      const key = await this.encryptService.rsaEncrypt(orgKey.key, publicKey);
      const req = new OrganizationUserConfirmRequest();
      req.key = key.encryptedString;
      await this.organizationUserApiService.postOrganizationUserConfirm(
        options.organizationId,
        id,
        req,
      );
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }
}

class Options {
  organizationId: string;

  constructor(passedOptions: Record<string, any>) {
    this.organizationId = passedOptions?.organizationid || passedOptions?.organizationId;
  }
}
