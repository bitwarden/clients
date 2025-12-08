import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule } from "@angular/core";

import { PasswordStrengthV2Component } from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { PasswordCalloutComponent } from "@bitwarden/auth/angular";
import { ScrollLayoutDirective } from "@bitwarden/components";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";
import { OrganizationFreeTrialWarningComponent } from "@bitwarden/web-vault/app/billing/organizations/warnings/components";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedOrganizationModule } from "../shared";

import { BulkConfirmDialogComponent } from "./components/bulk/bulk-confirm-dialog.component";
import { BulkDeleteDialogComponent } from "./components/bulk/bulk-delete-dialog.component";
import { BulkEnableSecretsManagerDialogComponent } from "./components/bulk/bulk-enable-sm-dialog.component";
import { BulkRemoveDialogComponent } from "./components/bulk/bulk-remove-dialog.component";
import { BulkRestoreRevokeComponent } from "./components/bulk/bulk-restore-revoke.component";
import { BulkStatusComponent } from "./components/bulk/bulk-status.component";
import { UserDialogModule } from "./components/member-dialog";
import { MembersRoutingModule } from "./members-routing.module";
import { MembersComponent } from "./members.component";
import {
  OrganizationMembersService,
  MemberActionsService,
  MemberDialogManagerService,
} from "./services";

@NgModule({
  imports: [
    SharedOrganizationModule,
    MembersRoutingModule,
    UserDialogModule,
    PasswordCalloutComponent,
    HeaderModule,
    ScrollingModule,
    PasswordStrengthV2Component,
    ScrollLayoutDirective,
    OrganizationFreeTrialWarningComponent,
  ],
  declarations: [
    BulkConfirmDialogComponent,
    BulkEnableSecretsManagerDialogComponent,
    BulkRemoveDialogComponent,
    BulkRestoreRevokeComponent,
    BulkStatusComponent,
    MembersComponent,
    BulkDeleteDialogComponent,
  ],
  providers: [
    OrganizationMembersService,
    MemberActionsService,
    BillingConstraintService,
    MemberDialogManagerService,
  ],
})
export class MembersModule {}
