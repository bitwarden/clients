import { ApiService } from "../../../abstractions/api.service";
import { UserId } from "../../../types/guid";
import { FolderApiServiceAbstraction } from "../../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { FolderData } from "../../../vault/models/data/folder.data";
import { Folder } from "../../../vault/models/domain/folder";
import { FolderRequest } from "../../../vault/models/request/folder.request";
import { FolderResponse } from "../../../vault/models/response/folder.response";

export class FolderApiService implements FolderApiServiceAbstraction {
  constructor(
    private folderService: InternalFolderService,
    private apiService: ApiService,
  ) {}

  async save(folder: Folder, userId: UserId): Promise<FolderData> {
    const request = new FolderRequest(folder);

    let response: FolderResponse;
    if (folder.id) {
      response = await this.putFolder(folder.id, request);
    } else {
      response = await this.postFolder(request);
      folder.id = response.id;
    }

    const data = new FolderData(response);
    await this.folderService.upsert(data, userId);
    return data;
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
