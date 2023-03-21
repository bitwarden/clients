import { Component } from "@angular/core";

import { OrganizationUserStatusType } from "@bitwarden/common/enums/organizationUserStatusType";
import { ProviderUserStatusType } from "@bitwarden/common/enums/providerUserStatusType";
import { Guid } from "@bitwarden/common/types/guid";

export interface BulkUserDetails {
  id: Guid;
  name: string;
  email: string;
  status: OrganizationUserStatusType | ProviderUserStatusType;
}

type BulkStatusEntry = {
  user: BulkUserDetails;
  error: boolean;
  message: string;
};

@Component({
  selector: "app-bulk-status",
  templateUrl: "bulk-status.component.html",
})
export class BulkStatusComponent {
  users: BulkStatusEntry[];
  loading = false;
}
