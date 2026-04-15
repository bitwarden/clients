import { Jsonify } from "type-fest";

import { ReceiveResponse } from "../response/receive.response";

import { ReceiveFileData } from "./receive-file.data";

export class ReceiveData {
  id: string;
  name: string;
  files: ReceiveFileData[] = [];
  userKeyWrappedSharedContentEncryptionKey: string;
  userKeyWrappedPrivateKey: string;
  scekWrappedPublicKey: string;
  secret: string;
  uploadCount: number;
  creationDate: string;
  revisionDate: string;
  expirationDate: string;

  constructor(response: ReceiveResponse) {
    this.id = response.id;
    this.name = response.name;
    this.userKeyWrappedSharedContentEncryptionKey =
      response.userKeyWrappedSharedContentEncryptionKey;
    this.userKeyWrappedPrivateKey = response.userKeyWrappedPrivateKey;
    this.scekWrappedPublicKey = response.scekWrappedPublicKey;
    this.secret = response.secret;
    this.uploadCount = response.uploadCount;
    this.creationDate = response.creationDate;
    this.revisionDate = response.revisionDate;
    this.expirationDate = response.expirationDate;

    this.files = response.files.map((f) => new ReceiveFileData(f));
  }

  static fromJSON(obj: Jsonify<ReceiveData>): ReceiveData {
    return Object.assign(Object.create(ReceiveData.prototype) as ReceiveData, obj, {
      files: obj.files?.map(ReceiveFileData.fromJSON) ?? [],
    });
  }
}
