import { firstValueFrom } from "rxjs";

import { SendAccessToken } from "../../../auth/send-access";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ListResponse } from "../../../models/response/list.response";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";

import { SendApiService } from "./send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "./send-api.service.abstraction";
import { SendSdkApiService } from "./send-sdk-api.service";

/**
 * Selects between SendApiService and SendSdkApiService based on the pm-30110-sdk-sends-api feature flag.
 */
export class SendApiServiceSelector implements SendApiServiceAbstraction {
  constructor(
    private configService: ConfigService,
    private sendApiService: SendApiService,
    private sendSdkApiService: SendSdkApiService,
  ) {}

  private async getService(): Promise<SendApiServiceAbstraction> {
    const useSdk = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.Pm30110SdkSendsApi),
    );
    return useSdk ? this.sendSdkApiService : this.sendApiService;
  }

  async save(sendData: [Send, EncArrayBuffer]): Promise<Send> {
    return (await this.getService()).save(sendData);
  }

  async delete(id: string): Promise<any> {
    return (await this.getService()).delete(id);
  }

  async removePassword(id: string): Promise<any> {
    return (await this.getService()).removePassword(id);
  }

  async getSend(id: string): Promise<SendResponse> {
    return (await this.getService()).getSend(id);
  }

  async postSendAccess(
    id: string,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendAccessResponse> {
    return (await this.getService()).postSendAccess(id, request, apiUrl);
  }

  async postSendAccessV2(
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendAccessResponse> {
    return (await this.getService()).postSendAccessV2(accessToken, apiUrl);
  }

  async getSends(): Promise<ListResponse<SendResponse>> {
    return (await this.getService()).getSends();
  }

  // Note: the SDK path uses the V2 endpoint which removes all auth (password and any other
  // auth type), not just the password.
  async putSendRemovePassword(id: string): Promise<SendResponse> {
    return (await this.getService()).putSendRemovePassword(id);
  }

  async deleteSend(id: string): Promise<any> {
    return (await this.getService()).deleteSend(id);
  }

  async getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    return (await this.getService()).getSendFileDownloadData(send, request, apiUrl);
  }

  async getSendFileDownloadDataV2(
    send: SendAccessView,
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    return (await this.getService()).getSendFileDownloadDataV2(send, accessToken, apiUrl);
  }
}
