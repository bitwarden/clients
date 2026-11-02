// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../../abstractions/api.service";
import { UploadOptions } from "../../abstractions/file-upload/file-upload.service";
import { LogService } from "../../abstractions/log.service";
import { Utils } from "../../misc/utils";

const MAX_SINGLE_BLOB_UPLOAD_SIZE = 256 * 1024 * 1024; // 256 MiB

export class AzureFileUploadService {
  constructor(
    private logService: LogService,
    private apiService: ApiService,
  ) {}

  async upload(
    url: string,
    data: EncArrayBuffer,
    renewalCallback: () => Promise<string>,
    options?: UploadOptions,
  ) {
    if (data.buffer.byteLength <= MAX_SINGLE_BLOB_UPLOAD_SIZE) {
      return await this.azureUploadBlob(url, data, options);
    } else {
      return await this.azureUploadBlocks(url, data, renewalCallback, options);
    }
  }

  private async azureUploadBlob(url: string, data: EncArrayBuffer, options?: UploadOptions) {
    const urlObject = Utils.getUrl(url);
    const headers = new Headers({
      "x-ms-date": new Date().toUTCString(),
      "x-ms-version": urlObject.searchParams.get("sv"),
      "Content-Length": data.buffer.byteLength.toString(),
      "x-ms-blob-type": "BlockBlob",
    });

    const request = new Request(url, {
      body: data.buffer as BodyInit,
      cache: "no-store",
      method: "PUT",
      headers: headers,
    });

    const blobResponse =
      Utils.isBrowser && options?.onProgress
        ? await this.apiService.nativeXMLHttpRequest(request, options.onProgress)
        : await this.apiService.nativeFetch(request);

    if (blobResponse.status !== 201) {
      throw new Error(`Failed to create Azure blob: ${blobResponse.status}`);
    }
  }

  private async azureUploadBlocks(
    url: string,
    data: EncArrayBuffer,
    renewalCallback: () => Promise<string>,
    options?: UploadOptions,
  ) {
    url = await this.renewUrlIfNecessary(url, renewalCallback);
    const blockUrl = Utils.getUrl(url);
    const blockId = this.encodedBlockId(0); // Only one block supported since max block size exceeds max file size
    blockUrl.searchParams.append("comp", "block");
    blockUrl.searchParams.append("blockid", blockId);
    const blockHeaders = new Headers({
      "x-ms-date": new Date().toUTCString(),
      "x-ms-version": blockUrl.searchParams.get("sv"),
      "Content-Length": data.buffer.byteLength.toString(),
    });

    const blockRequest = new Request(blockUrl.toString(), {
      body: data.buffer as BodyInit,
      cache: "no-store",
      method: "PUT",
      headers: blockHeaders,
    });

    const blockResponse =
      Utils.isBrowser && options?.onProgress
        ? await this.apiService.nativeXMLHttpRequest(blockRequest, options.onProgress)
        : await this.apiService.nativeFetch(blockRequest);

    if (blockResponse.status !== 201) {
      const message = `Unsuccessful block PUT. Received status ${blockResponse.status}`;
      this.logService.error(message + "\n" + (await blockResponse.json()));
      throw new Error(message);
    }

    url = await this.renewUrlIfNecessary(url, renewalCallback);
    const blockListUrl = Utils.getUrl(url);
    const blockListXml = this.blockListXml([blockId]);
    blockListUrl.searchParams.append("comp", "blocklist");
    const headers = new Headers({
      "x-ms-date": new Date().toUTCString(),
      "x-ms-version": blockListUrl.searchParams.get("sv"),
      "Content-Length": blockListXml.length.toString(),
    });

    const request = new Request(blockListUrl.toString(), {
      body: blockListXml,
      cache: "no-store",
      method: "PUT",
      headers: headers,
    });

    const response = await this.apiService.nativeFetch(request);

    if (response.status !== 201) {
      const message = `Unsuccessful block list PUT. Received status ${response.status}`;
      this.logService.error(message + "\n" + (await response.json()));
      throw new Error(message);
    }
  }

  private async renewUrlIfNecessary(
    url: string,
    renewalCallback: () => Promise<string>,
  ): Promise<string> {
    const urlObject = Utils.getUrl(url);
    const expiry = new Date(urlObject.searchParams.get("se") ?? "");

    if (isNaN(expiry.getTime())) {
      expiry.setTime(Date.now() + 3600000);
    }

    if (expiry.getTime() < Date.now() + 1000) {
      return await renewalCallback();
    }
    return url;
  }

  private encodedBlockId(blockIndex: number) {
    // Encoded blockId max size is 64, so pre-encoding max size is 48
    const utfBlockId = (
      "000000000000000000000000000000000000000000000000" + blockIndex.toString()
    ).slice(-48);
    return Utils.fromUtf8ToB64(utfBlockId);
  }

  private blockListXml(blockIdList: string[]) {
    let xml = '<?xml version="1.0" encoding="utf-8"?><BlockList>';
    blockIdList.forEach((blockId) => {
      xml += `<Latest>${blockId}</Latest>`;
    });
    xml += "</BlockList>";
    return xml;
  }
}
