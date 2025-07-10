import { DragDropModule } from "@angular/cdk/drag-drop";
import { OverlayModule } from "@angular/cdk/overlay";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CoreModule } from "@bitwarden/web-vault/app/core";
import { OssRoutingModule } from "@bitwarden/web-vault/app/oss-routing.module";
import { OssModule } from "@bitwarden/web-vault/app/oss.module";
import { WildcardRoutingModule } from "@bitwarden/web-vault/app/wildcard-routing.module";

import { OrganizationsModule } from "./admin-console/organizations/organizations.module";
import { ActivateAutofillPolicyComponent } from "./admin-console/policies/activate-autofill.component";
import { AutomaticAppLoginPolicyComponent } from "./admin-console/policies/automatic-app-login.component";
import { DisablePersonalVaultExportPolicyComponent } from "./admin-console/policies/disable-personal-vault-export.component";
import { MaximumVaultTimeoutPolicyComponent } from "./admin-console/policies/maximum-vault-timeout.component";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { FreeFamiliesSponsorshipPolicyComponent } from "./billing/policies/free-families-sponsorship.component";
import { AccessIntelligenceModule } from "./dirt/access-intelligence/access-intelligence.module";

/**
 * This is the AppModule for the commercial version of Bitwarden.
 * `apps/web/app.module.ts` contains the OSS version.
 *
 * You probably do not want to modify this file. Consider editing `oss.module.ts` instead.
 */
@NgModule({
  imports: [
    OverlayModule,
    OssModule,
    JslibModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    CoreModule,
    DragDropModule,
    AppRoutingModule,
    OssRoutingModule,
    OrganizationsModule, // Must be after OssRoutingModule for competing routes to resolve properly
    AccessIntelligenceModule,
    RouterModule,
    WildcardRoutingModule, // Needs to be last to catch all non-existing routes
  ],
  declarations: [
    AppComponent,
    DisablePersonalVaultExportPolicyComponent,
    MaximumVaultTimeoutPolicyComponent,
    ActivateAutofillPolicyComponent,
    AutomaticAppLoginPolicyComponent,
    FreeFamiliesSponsorshipPolicyComponent,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
