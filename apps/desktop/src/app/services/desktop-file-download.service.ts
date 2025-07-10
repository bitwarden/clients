import { Injectable } from "@angular/core";

import { FileDownloadBuilder } from "@bitwarden/common/platform/abstractions/file-download/file-download.builder";
import { FileDownloadRequest } from "@bitwarden/common/platform/abstractions/file-download/file-download.request";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";

@Injectable()
export class DesktopFileDownloadService implements FileDownloadService {
  download(request: FileDownloadRequest): void {
    const a = window.document.createElement("a");
    a.href = URL.createObjectURL(new FileDownloadBuilder(request).blob);
    a.download = request.fileName;
    a.style.position = "fixed";
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  }
}
