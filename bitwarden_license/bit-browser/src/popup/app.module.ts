import { OverlayModule } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
// import { AppRoutingAnimationsModule } from "@bitwarden/browser/popup/app-routing-animations";
import {
  DefaultVaultHealthReportService,
  VaultHealthReportService,
} from "@bitwarden/bit-common/dirt/vault-health/services";
import { AppRoutingModule as OssRoutingModule } from "@bitwarden/browser/popup/app-routing.module";
import { AppModule as OssModule } from "@bitwarden/browser/popup/app.module";
// import { WildcardRoutingModule } from "@bitwarden/browser/popup/wildcard-routing.module";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { safeProvider } from "@bitwarden/ui-common";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
/**
 * This is the AppModule for the commercial version of Bitwarden.
 * `apps/browser/app.module.ts` contains the OSS version.
 *
 * You probably do not want to modify this file. Consider editing `oss.module.ts` instead.
 */
@NgModule({
  imports: [
    CommonModule,
    OverlayModule,
    OssModule,
    JslibModule,
    // BrowserAnimationsModule,
    // FormsModule,
    // ReactiveFormsModule,
    // CoreModule,
    // DragDropModule,
    AppRoutingModule,
    OssRoutingModule,
    RouterModule,
    // WildcardRoutingModule, // Needs to be last to catch all non-existing routes
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [
    safeProvider({
      provide: VaultHealthReportService,
      useClass: DefaultVaultHealthReportService,
      deps: [CipherRiskService],
    }),
  ],
})
export class AppModule {}
