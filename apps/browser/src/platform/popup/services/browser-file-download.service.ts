// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { FileDownloadBuilder } from "@bitwarden/common/platform/abstractions/file-download/file-download.builder";
import { FileDownloadRequest } from "@bitwarden/common/platform/abstractions/file-download/file-download.request";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SafariApp } from "../../../browser/safariApp";
import { BrowserApi } from "../../browser/browser-api";

@Injectable()
export class BrowserFileDownloadService implements FileDownloadService {
  download(request: FileDownloadRequest): void {
    const builder = new FileDownloadBuilder(request);
    if (BrowserApi.isSafariApi) {
      // Handle Safari download asynchronously to allow Blob conversion
      // This function can't be async because the interface is not async
      void this.downloadSafari(request, builder);
    } else {
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(builder.blob);
      a.download = request.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    }
  }

  private async downloadSafari(
    request: FileDownloadRequest,
    builder: FileDownloadBuilder,
  ): Promise<void> {
    let data: string = null;
    if (builder.blobOptions.type === "text/plain" && typeof request.blobData === "string") {
      data = request.blobData;
    } else if (request.blobData instanceof Blob) {
      // Convert Blob to ArrayBuffer first, then to Base64
      const arrayBuffer = await request.blobData.arrayBuffer();
      data = Utils.fromBufferToB64(arrayBuffer);
    } else {
      // Already an ArrayBuffer
      data = Utils.fromBufferToB64(request.blobData as ArrayBuffer);
    }

    await SafariApp.sendMessageToApp(
      "downloadFile",
      JSON.stringify({
        blobData: data,
        blobOptions: request.blobOptions,
        fileName: request.fileName,
      }),
      true,
    );
  }
}
