import { ReceiveFileUploadInput } from "../models/receive-file-upload-input";

export abstract class ReceiveFileService {
  abstract uploadFile(input: ReceiveFileUploadInput): Promise<void>;
}
