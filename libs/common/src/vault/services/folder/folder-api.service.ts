import { ApiService } from "../../../abstractions/api.service";
import { UserId } from "../../../types/guid";
import { FolderApiServiceAbstraction } from "../../../vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "../../../vault/abstractions/folder/folder.service.abstraction";
import { FolderData } from "../../../vault/models/data/folder.data";
import { Folder } from "../../../vault/models/domain/folder";
import { FolderBulkDeleteRequest } from "../../../vault/models/request/folder-bulk-delete.request";
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
      response = await this.putFolder(folder.id, request, userId);
    } else {
      response = await this.postFolder(request, userId);
      folder.id = response.id;
    }

    const data = new FolderData(response);
    await this.folderService.upsert(data, userId);
    return data;
  }

  async delete(id: string, userId: UserId): Promise<any> {
    await this.deleteFolder(id, userId);
    await this.folderService.delete(id, userId);
  }

  async deleteMany(ids: string[], userId: UserId): Promise<any> {
    await this.apiService.send(
      "DELETE",
      "/folders",
      new FolderBulkDeleteRequest(ids),
      userId,
      false,
    );
    await this.folderService.delete(ids, userId);
  }

  async deleteAll(userId: UserId): Promise<void> {
    await this.apiService.send("DELETE", "/folders/all", null, userId, false);
    await this.folderService.clear(userId);
  }

  async get(id: string, userId: UserId): Promise<FolderResponse> {
    const r = await this.apiService.send("GET", "/folders/" + id, null, userId, true);
    return new FolderResponse(r);
  }

  private async postFolder(request: FolderRequest, userId: UserId): Promise<FolderResponse> {
    const r = await this.apiService.send("POST", "/folders", request, userId, true);
    return new FolderResponse(r);
  }

  async putFolder(id: string, request: FolderRequest, userId: UserId): Promise<FolderResponse> {
    const r = await this.apiService.send("PUT", "/folders/" + id, request, userId, true);
    return new FolderResponse(r);
  }

  private deleteFolder(id: string, userId: UserId): Promise<any> {
    return this.apiService.send("DELETE", "/folders/" + id, null, userId, false);
  }
}
