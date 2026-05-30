import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Count of pending lease requests visible to the calling approver.
 * Used to drive the navigation badge without fetching every row.
 */
export class InboxBadgeCountResponse extends BaseResponse {
  count: number;

  constructor(response: unknown) {
    super(response);
    this.count = this.getResponseProperty("Count") ?? 0;
  }
}
