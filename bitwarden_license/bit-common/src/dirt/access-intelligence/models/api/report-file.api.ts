import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Metadata for an uploaded report file.
 */
export class ReportFileApi extends BaseResponse {
  id: string | undefined;
  fileName: string = "";
  /** File size in bytes. Serialized as a string by the server. */
  size: number = 0;
  validated: boolean = false;

  constructor(data: any) {
    super(data);
    this.id = this.getResponseProperty("id") ?? undefined;
    this.fileName = this.getResponseProperty("fileName") ?? "";
    this.size = Number(this.getResponseProperty("size") ?? 0);
    this.validated = this.getResponseProperty("validated") ?? false;
  }
}
