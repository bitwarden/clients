import { BaseResponse } from "../../../../models/response/base.response";
import { ReceiveFileApi } from "../api/receive-file.api";

export class ReceiveResponse extends BaseResponse {
  id: string;
  name: string;
  files: ReceiveFileApi[] = [];
  userKeyWrappedSharedContentEncryptionKey: string;
  userKeyWrappedPrivateKey: string;
  scekWrappedPublicKey: string;
  secret: string;
  uploadCount: number;
  creationDate: string;
  revisionDate: string;
  expirationDate: string;

  constructor(response: any) {
    super(response);

    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.userKeyWrappedSharedContentEncryptionKey = this.getResponseProperty(
      "UserKeyWrappedSharedContentEncryptionKey",
    );
    this.userKeyWrappedPrivateKey = this.getResponseProperty("UserKeyWrappedPrivateKey");
    this.scekWrappedPublicKey = this.getResponseProperty("ScekWrappedPublicKey");
    this.secret = this.getResponseProperty("Secret");
    this.uploadCount = this.getResponseProperty("UploadCount");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.expirationDate = this.getResponseProperty("ExpirationDate");

    const files = this.getResponseProperty("Files");
    this.files = files != null ? files.map((f: any) => new ReceiveFileApi(f)) : [];
  }
}
