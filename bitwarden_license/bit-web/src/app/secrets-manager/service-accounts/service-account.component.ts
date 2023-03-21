import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { switchMap } from "rxjs";

import { Guid } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { AccessTokenCreateDialogComponent } from "./access/dialogs/access-token-create-dialog.component";
import { ServiceAccountService } from "./service-account.service";

@Component({
  selector: "sm-service-account",
  templateUrl: "./service-account.component.html",
})
export class ServiceAccountComponent {
  private organizationId: Guid;
  private serviceAccountId: Guid;

  /**
   * TODO: remove when a server method is available that fetches a service account by ID
   */
  protected serviceAccount$ = this.route.params.pipe(
    switchMap((params) => {
      this.serviceAccountId = params.serviceAccountId;
      this.organizationId = params.organizationId;

      return this.serviceAccountService
        .getServiceAccounts(params.organizationId)
        .then((saList) => saList.find((sa) => sa.id === params.serviceAccountId));
    })
  );

  constructor(
    private route: ActivatedRoute,
    private serviceAccountService: ServiceAccountService,
    private dialogService: DialogService
  ) {}

  protected openNewAccessTokenDialog() {
    AccessTokenCreateDialogComponent.openNewAccessTokenDialog(
      this.dialogService,
      this.serviceAccountId,
      this.organizationId
    );
  }
}
