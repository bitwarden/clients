import { NgModule } from "@angular/core";

import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import {
  AccessReportEncryptionService,
  ApplicationVersioningService,
  DefaultAccessReportEncryptionService,
  ReportVersioningService,
  SummaryVersioningService,
} from "@bitwarden/bit-common/dirt/access-intelligence/services";
import {
  RiskInsightsApiService,
  SecurityTasksApiService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { DefaultAdminTaskService } from "../../vault/services/default-admin-task.service";

import { AccessIntelligenceRoutingModule } from "./access-intelligence-routing.module";
import { NewApplicationsDialogComponent } from "./activity/application-review-dialog/new-applications-dialog.component";
import { RiskInsightsComponent } from "./risk-insights.component";
import { AccessIntelligencePageComponent } from "./v2/access-intelligence-page/access-intelligence-page.component";

@NgModule({
  imports: [
    RiskInsightsComponent,
    AccessIntelligenceRoutingModule,
    NewApplicationsDialogComponent,
    AccessIntelligencePageComponent,
  ],
  providers: [
    safeProvider({
      provide: RiskInsightsApiService,
      useClass: RiskInsightsApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: SecurityTasksApiService,
      useClass: SecurityTasksApiService,
      deps: [ApiService],
    }),
    safeProvider(DefaultAdminTaskService),
    safeProvider({
      provide: ReportVersioningService,
      deps: [LogService],
    }),
    safeProvider({
      provide: ApplicationVersioningService,
      deps: [LogService],
    }),
    safeProvider({
      provide: SummaryVersioningService,
      deps: [LogService],
    }),
    safeProvider({
      provide: AccessReportEncryptionService,
      useClass: DefaultAccessReportEncryptionService,
      deps: [
        KeyService,
        EncryptService,
        KeyGenerationService,
        ReportVersioningService,
        ApplicationVersioningService,
        SummaryVersioningService,
        LogService,
      ],
    }),
  ],
})
export class AccessIntelligenceModule {}
