import { ReceiveFileUploadInput } from "../models/receive-file-upload-input";
import { ReceiveFileView } from "../models/view/receive-file.view";

export abstract class ReceiveFileService {
  abstract uploadFile(input: ReceiveFileUploadInput): Promise<void>;
  abstract downloadFile(fileView: ReceiveFileView): Promise<void>;
}
