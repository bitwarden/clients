import { CommonModule } from "@angular/common";
import { ComponentFactoryResolver, NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { SearchModule } from "@bitwarden/components";
import { OssModule } from "@bitwarden/web-vault/app/oss.module";

import { AddOrganizationComponent } from "./clients/add-organization.component";
import { ClientsComponent } from "./clients/clients.component";
import { CreateOrganizationComponent } from "./clients/create-organization.component";
import { ProviderPermissionsGuard } from "./guards/provider-permissions.guard";
import { AcceptProviderComponent } from "./manage/accept-provider.component";
import { BulkConfirmComponent } from "./manage/bulk/bulk-confirm.component";
import { BulkRemoveComponent } from "./manage/bulk/bulk-remove.component";
import { EventsComponent } from "./manage/events.component";
import { ManageComponent } from "./manage/manage.component";
import { PeopleComponent } from "./manage/people.component";
import { UserAddEditComponent } from "./manage/user-add-edit.component";
import { ProvidersLayoutComponent } from "./providers-layout.component";
import { ProvidersRoutingModule } from "./providers-routing.module";
import { WebProviderService } from "./services/web-provider.service";
import { AccountComponent } from "./settings/account.component";
import { SettingsComponent } from "./settings/settings.component";
import { SetupProviderComponent } from "./setup/setup-provider.component";
import { SetupComponent } from "./setup/setup.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    OssModule,
    JslibModule,
    SearchModule,
    ProvidersRoutingModule,
  ],
  declarations: [
    AcceptProviderComponent,
    AccountComponent,
    AddOrganizationComponent,
    BulkConfirmComponent,
    BulkRemoveComponent,
    ClientsComponent,
    CreateOrganizationComponent,
    EventsComponent,
    ManageComponent,
    PeopleComponent,
    ProvidersLayoutComponent,
    SettingsComponent,
    SetupComponent,
    SetupProviderComponent,
    UserAddEditComponent,
  ],
  providers: [WebProviderService, ProviderPermissionsGuard],
})
export class ProvidersModule {
  constructor(modalService: ModalService, componentFactoryResolver: ComponentFactoryResolver) {
    modalService.registerComponentFactoryResolver(
      AddOrganizationComponent,
      componentFactoryResolver
    );
  }
}
