import { OrganizationUserBulkResponse } from "@bitwarden/admin-console/common";

export const REQUESTS_PER_BATCH = 500;

export interface MemberActionResult {
  success: boolean;
  error?: string;
}

export class BulkActionResult {
  successful: OrganizationUserBulkResponse[] = [];
  failed: { id: string; error: string }[] = [];
}
