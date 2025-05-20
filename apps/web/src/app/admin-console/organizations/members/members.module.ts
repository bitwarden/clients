import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule } from "@angular/core";

import { PasswordStrengthV2Component } from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { PasswordCalloutComponent } from "@bitwarden/auth/angular";

import { LooseComponentsModule } from "../../../shared";
import { SharedOrganizationModule } from "../shared";

import { BulkConfirmDialogComponent } from "./components/bulk/bulk-confirm-dialog.component";
import { BulkDeleteDialogComponent } from "./components/bulk/bulk-delete-dialog.component";
import { BulkEnableSecretsManagerDialogComponent } from "./components/bulk/bulk-enable-sm-dialog.component";
import { BulkRemoveDialogComponent } from "./components/bulk/bulk-remove-dialog.component";
import { BulkRestoreRevokeComponent } from "./components/bulk/bulk-restore-revoke.component";
import { BulkStatusComponent } from "./components/bulk/bulk-status.component";
import { UserDialogModule } from "./components/member-dialog";
import { ResetPasswordComponent } from "./components/reset-password.component";
import { MembersRoutingModule } from "./members-routing.module";
import { MembersComponent } from "./members.component";

@NgModule({
  imports: [
    SharedOrganizationModule,
    LooseComponentsModule,
    MembersRoutingModule,
    UserDialogModule,
    PasswordCalloutComponent,
    ScrollingModule,
    PasswordStrengthV2Component,
  ],
  declarations: [
    BulkConfirmDialogComponent,
    BulkEnableSecretsManagerDialogComponent,
    BulkRemoveDialogComponent,
    BulkRestoreRevokeComponent,
    BulkStatusComponent,
    MembersComponent,
    ResetPasswordComponent,
    BulkDeleteDialogComponent,
  ],
})
export class MembersModule {}
