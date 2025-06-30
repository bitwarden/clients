import { firstValueFrom, map } from "rxjs";

import { FolderAddEditRequest } from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../../types/guid";
import { FolderApiServiceAbstraction } from "../../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { FolderData } from "../../../vault/models/data/folder.data";
import { Folder } from "../../../vault/models/domain/folder";
import { FolderRequest } from "../../../vault/models/request/folder.request";
import { FolderResponse } from "../../../vault/models/response/folder.response";
import { FolderView } from "../../models/view/folder.view";

export class FolderApiService implements FolderApiServiceAbstraction {
  constructor(
    private folderService: InternalFolderService,
    private apiService: ApiService,
    private sdkService: SdkService,
  ) {}

  async save(folder: Folder, userId: UserId): Promise<FolderData> {
    const request = new FolderRequest(folder);

    let response: FolderResponse;
    if (folder.id == null) {
      response = await this.postFolder(request);
      folder.id = response.id;
    } else {
      response = await this.putFolder(folder.id, request);
    }

    const data = new FolderData(response);
    await this.folderService.upsert(data, userId);
    return data;
  }

  async create(request: FolderAddEditRequest, userId: UserId): Promise<FolderView> {
    const folder = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map(async (sdk) => {
          using ref = sdk.take();

          const sdkFolder = await ref.value.vault().folders().create(request);
          return FolderView.fromSdk(sdkFolder);
        }),
      ),
    );

    return folder;
  }

  async delete(id: string, userId: UserId): Promise<any> {
    await this.deleteFolder(id);
    await this.folderService.delete(id, userId);
  }

  async deleteAll(userId: UserId): Promise<void> {
    await this.apiService.send("DELETE", "/folders/all", null, true, false);
    await this.folderService.clear(userId);
  }

  async get(id: string): Promise<FolderResponse> {
    const r = await this.apiService.send("GET", "/folders/" + id, null, true, true);
    return new FolderResponse(r);
  }

  private async postFolder(request: FolderRequest): Promise<FolderResponse> {
    const r = await this.apiService.send("POST", "/folders", request, true, true);
    return new FolderResponse(r);
  }

  async putFolder(id: string, request: FolderRequest): Promise<FolderResponse> {
    const r = await this.apiService.send("PUT", "/folders/" + id, request, true, true);
    return new FolderResponse(r);
  }

  private deleteFolder(id: string): Promise<any> {
    return this.apiService.send("DELETE", "/folders/" + id, null, true, false);
  }
}
