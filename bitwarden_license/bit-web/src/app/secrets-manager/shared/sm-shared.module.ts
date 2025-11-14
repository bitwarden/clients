import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule } from "@angular/core";

import {
  CardComponent,
  MultiSelectModule,
  SearchModule,
  SelectModule,
  NoItemsModule,
  FormFieldModule,
  ScrollLayoutDirective,
} from "@bitwarden/components";
import { CoreOrganizationModule } from "@bitwarden/web-vault/app/admin-console/organizations/core";
import { DynamicAvatarComponent } from "@bitwarden/web-vault/app/components/dynamic-avatar.component";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { ProductSwitcherModule } from "@bitwarden/web-vault/app/layouts/product-switcher/product-switcher.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { AccessPolicySelectorComponent } from "./access-policies/access-policy-selector/access-policy-selector.component";
import { BulkConfirmationDialogComponent } from "./dialogs/bulk-confirmation-dialog.component";
import { BulkStatusDialogComponent } from "./dialogs/bulk-status-dialog.component";
import { NewMenuComponent } from "./new-menu.component";
import { OrgSuspendedComponent } from "./org-suspended.component";
import { ProjectsListComponent } from "./projects-list.component";
import { SecretsListComponent } from "./secrets-list.component";

@NgModule({
  imports: [
    SharedModule,
    ScrollingModule,
    ProductSwitcherModule,
    MultiSelectModule,
    CoreOrganizationModule,
    NoItemsModule,
    SelectModule,
    DynamicAvatarComponent,
    SearchModule,
    HeaderModule,
    CardComponent,
    FormFieldModule,
    ScrollLayoutDirective,
  ],
  exports: [
    AccessPolicySelectorComponent,
    BulkConfirmationDialogComponent,
    BulkStatusDialogComponent,
    FormFieldModule,
    HeaderModule,
    NewMenuComponent,
    NoItemsModule,
    ProjectsListComponent,
    SearchModule,
    SecretsListComponent,
    CardComponent,
    SelectModule,
    SharedModule,
  ],
  declarations: [
    AccessPolicySelectorComponent,
    BulkConfirmationDialogComponent,
    BulkStatusDialogComponent,
    BulkStatusDialogComponent,
    NewMenuComponent,
    OrgSuspendedComponent,
    ProjectsListComponent,
    SecretsListComponent,
  ],
  providers: [],
  bootstrap: [],
})
export class SecretsManagerSharedModule {}
