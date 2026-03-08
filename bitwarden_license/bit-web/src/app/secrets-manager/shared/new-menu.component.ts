// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { concatMap, firstValueFrom } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DialogService } from "@bitwarden/components";

import {
  ProjectDialogComponent,
  ProjectOperation,
} from "../projects/dialog/project-dialog.component";
import {
  OperationType,
  SecretDialogComponent,
  SecretOperation,
} from "../secrets/dialog/secret-dialog.component";
import {
  ServiceAccountDialogComponent,
  ServiceAccountOperation,
} from "../service-accounts/dialog/service-account-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-new-menu",
  templateUrl: "./new-menu.component.html",
  standalone: false,
})
export class NewMenuComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private organizationId: string;
  private organizationEnabled: boolean;
  constructor(
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    this.route.params
      .pipe(
        concatMap(async (params) => {
          const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
          return await firstValueFrom(
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((org) => {
        this.organizationId = org.id;
        this.organizationEnabled = org.enabled;
      });
  }

  openSecretDialog() {
    this.dialogService.open<unknown, SecretOperation>(SecretDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openProjectDialog() {
    this.dialogService.open<unknown, ProjectOperation>(ProjectDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openServiceAccountDialog() {
    this.dialogService.open<unknown, ServiceAccountOperation>(ServiceAccountDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }
}
