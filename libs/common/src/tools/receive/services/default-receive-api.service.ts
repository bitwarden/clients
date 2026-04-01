import { ApiService } from "../../../abstractions/api.service";
import { CreateReceiveRequest } from "../models/requests/create-receive.request";
import { UpdateReceiveRequest } from "../models/requests/update-receive.request";
import { ReceiveFileDownloadDataResponse } from "../models/response/receive-file-download-data.response";
import { ReceiveFileUploadDataResponse } from "../models/response/receive-file-upload-data.response";
import { ReceiveSharedDataResponse } from "../models/response/receive-shared-data.response";
import { ReceiveResponse } from "../models/response/receive.response";

import { ReceiveApiService } from "./receive-api.service";

export class DefaultReceiveApiService implements ReceiveApiService {
  constructor(private apiService: ApiService) {}

  async getReceive(id: string): Promise<ReceiveResponse> {
    const r = await this.apiService.send("GET", "/receives/" + id, null, true, true);
    return new ReceiveResponse(r);
  }

  async postReceive(request: CreateReceiveRequest): Promise<ReceiveResponse> {
    const r = await this.apiService.send("POST", "/receives", request, true, true);
    return new ReceiveResponse(r);
  }

  async putReceive(id: string, request: UpdateReceiveRequest): Promise<ReceiveResponse> {
    const r = await this.apiService.send("PUT", "/receives/" + id, request, true, true);
    return new ReceiveResponse(r);
  }

  async deleteReceive(id: string): Promise<void> {
    await this.apiService.send("DELETE", "/receives/" + id, null, true, false);
  }

  async postReceiveAccess(id: string, secret: string): Promise<ReceiveSharedDataResponse> {
    const addSecretHeader = (headers: Headers) => {
      headers.set("Receive-Secret", secret);
    };
    const r = await this.apiService.send(
      "GET",
      "/receives/" + id + "/shared",
      null,
      false,
      true,
      undefined,
      addSecretHeader,
    );
    return new ReceiveSharedDataResponse(r);
  }

  async postReceiveFile(
    id: string,
    secret: string,
    request: { fileName: string; fileLength: number; encapsulatedFileContentEncryptionKey: string },
  ): Promise<ReceiveFileUploadDataResponse> {
    const addSecretHeader = (headers: Headers) => {
      headers.set("Receive-Secret", secret);
    };
    const r = await this.apiService.send(
      "POST",
      "/receives/" + id + "/file",
      request,
      false,
      true,
      undefined,
      addSecretHeader,
    );
    return new ReceiveFileUploadDataResponse(r);
  }

  async postReceiveFileValidation(id: string, fileId: string, secret: string): Promise<void> {
    const addSecretHeader = (headers: Headers) => {
      headers.set("Receive-Secret", secret);
    };
    await this.apiService.send(
      "POST",
      "/receives/" + id + "/file/" + fileId + "/validate",
      null,
      false,
      false,
      undefined,
      addSecretHeader,
    );
  }

  async getReceiveFileDownload(
    id: string,
    fileId: string,
  ): Promise<ReceiveFileDownloadDataResponse> {
    const r = await this.apiService.send(
      "GET",
      "/receives/" + id + "/file/" + fileId,
      null,
      true,
      true,
    );
    return new ReceiveFileDownloadDataResponse(r);
  }
}
