// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FileDownloadRequest } from "./file-download.request";

export class FileDownloadBuilder {
  get blobOptions(): any {
    const options = this._request.blobOptions ?? {};
    if (options.type == null) {
      options.type = this.fileType;
    }
    return options;
  }

  get blob(): Blob {
    if (this.blobOptions != null) {
      return new Blob([this._request.blobData], this.blobOptions);
    } else {
      return new Blob([this._request.blobData]);
    }
  }

  get downloadMethod(): "save" | "open" {
    if (this._request.downloadMethod != null) {
      return this._request.downloadMethod;
    }
    return this.fileType != "application/pdf" ? "save" : "open";
  }

  private get fileType() {
    const fileNameLower = this._request.fileName.toLowerCase();
    if (fileNameLower.endsWith(".pdf")) {
      return "application/pdf";
    } else if (fileNameLower.endsWith(".xlsx")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (fileNameLower.endsWith(".docx")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (fileNameLower.endsWith(".pptx")) {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (fileNameLower.endsWith(".csv")) {
      return "text/csv";
    } else if (fileNameLower.endsWith(".png")) {
      return "image/png";
    } else if (fileNameLower.endsWith(".jpg") || fileNameLower.endsWith(".jpeg")) {
      return "image/jpeg";
    } else if (fileNameLower.endsWith(".gif")) {
      return "image/gif";
    }
    return null;
  }

  constructor(private readonly _request: FileDownloadRequest) {}
}
