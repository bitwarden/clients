import { FileDownloadRequest } from "./file-download.request";

export abstract class FileDownloadService {
  abstract download(request: FileDownloadRequest): void;
}
