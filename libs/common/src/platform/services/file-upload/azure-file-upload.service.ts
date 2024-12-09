// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "../../../abstractions/api.service";
import { LogService } from "../../abstractions/log.service";
import { Utils } from "../../misc/utils";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";

const MAX_SINGLE_BLOB_UPLOAD_SIZE = 256 * 1024 * 1024; // 256 MiB
const MAX_BLOCKS_PER_BLOB = 50000;

export class AzureFileUploadService {
  constructor(
    private logService: LogService,
    private apiService: ApiService,
  ) {}

  async upload(url: string, data: EncArrayBuffer, renewalCallback: () => Promise<string>) {
    if (data.buffer.byteLength <= MAX_SINGLE_BLOB_UPLOAD_SIZE) {
      return await this.azureUploadBlob(url, data);
    } else {
      return await this.azureUploadBlocks(url, data, renewalCallback);
    }
  }
  private async azureUploadBlob(url: string, data: EncArrayBuffer) {
    const urlObject = Utils.getUrl(url);
    const headers = new Headers({
      "x-ms-date": new Date().toUTCString(),
      "x-ms-version": urlObject.searchParams.get("sv"),
      "Content-Length": data.buffer.byteLength.toString(),
      "x-ms-blob-type": "BlockBlob",
    });

    const request = new Request(url, {
      body: data.buffer,
      cache: "no-store",
      method: "PUT",
      headers: headers,
    });

    const blobResponse = await this.apiService.nativeFetch(request);

    if (blobResponse.status !== 201) {
      throw new Error(`Failed to create Azure blob: ${blobResponse.status}`);
    }
  }
  private async azureUploadBlocks(
    url: string,
    data: EncArrayBuffer,
    renewalCallback: () => Promise<string>,
  ) {
    const baseUrl = Utils.getUrl(url);
    const blockSize = this.getMaxBlockSize(baseUrl.searchParams.get("sv"));
    let blockIndex = 0;
    const numBlocks = Math.ceil(data.buffer.byteLength / blockSize);
    const blocksStaged: string[] = [];

    if (numBlocks > MAX_BLOCKS_PER_BLOB) {
      throw new Error(
        `Cannot upload file, exceeds maximum size of ${blockSize * MAX_BLOCKS_PER_BLOB}`,
      );
    }

    // eslint-disable-next-line
    try {
      while (blockIndex < numBlocks) {
        url = await this.renewUrlIfNecessary(url, renewalCallback);
        const blockUrl = Utils.getUrl(url);
        const blockId = this.encodedBlockId(blockIndex);
        blockUrl.searchParams.append("comp", "block");
        blockUrl.searchParams.append("blockid", blockId);
        const start = blockIndex * blockSize;
        const blockData = data.buffer.slice(start, start + blockSize);
        const blockHeaders = new Headers({
          "x-ms-date": new Date().toUTCString(),
          "x-ms-version": blockUrl.searchParams.get("sv"),
          "Content-Length": blockData.byteLength.toString(),
        });

        const blockRequest = new Request(blockUrl.toString(), {
          body: blockData,
          cache: "no-store",
          method: "PUT",
          headers: blockHeaders,
        });

        const blockResponse = await this.apiService.nativeFetch(blockRequest);

        if (blockResponse.status !== 201) {
          const message = `Unsuccessful block PUT. Received status ${blockResponse.status}`;
          this.logService.error(message + "\n" + (await blockResponse.json()));
          throw new Error(message);
        }

        blocksStaged.push(blockId);
        blockIndex++;
      }

      url = await this.renewUrlIfNecessary(url, renewalCallback);
      const blockListUrl = Utils.getUrl(url);
      const blockListXml = this.blockListXml(blocksStaged);
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
    } catch (e) {
      throw e;
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

  private getMaxBlockSize(version: string) {
    if (Version.compare(version, "2019-12-12") >= 0) {
      return 4000 * 1024 * 1024; // 4000 MiB
    } else if (Version.compare(version, "2016-05-31") >= 0) {
      return 100 * 1024 * 1024; // 100 MiB
    } else {
      return 4 * 1024 * 1024; // 4 MiB
    }
  }
}

class Version {
  /**
   * Compares two Azure Versions against each other
   * @param a Version to compare
   * @param b Version to compare
   * @returns a number less than zero if b is newer than a, 0 if equal,
   * and greater than zero if a is newer than b
   */
  static compare(a: Required<Version> | string, b: Required<Version> | string) {
    if (typeof a === "string") {
      a = new Version(a);
    }

    if (typeof b === "string") {
      b = new Version(b);
    }

    return a.year !== b.year
      ? a.year - b.year
      : a.month !== b.month
        ? a.month - b.month
        : a.day !== b.day
          ? a.day - b.day
          : 0;
  }
  year = 0;
  month = 0;
  day = 0;

  constructor(version: string) {
    try {
      const parts = version.split("-").map((v) => Number.parseInt(v, 10));
      this.year = parts[0];
      this.month = parts[1];
      this.day = parts[2];
    } catch {
      // Ignore error
    }
  }
  /**
   * Compares two Azure Versions against each other
   * @param compareTo Version to compare against
   * @returns a number less than zero if compareTo is newer, 0 if equal,
   * and greater than zero if this is greater than compareTo
   */
  compare(compareTo: Required<Version> | string) {
    return Version.compare(this, compareTo);
  }
}
