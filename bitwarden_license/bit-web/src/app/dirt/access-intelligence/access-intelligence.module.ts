import { NgModule } from "@angular/core";

import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { CriticalAppsService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  AllActivitiesService,
  CriticalAppsApiService,
  MemberCipherDetailsApiService,
  PasswordHealthService,
  RiskInsightsApiService,
  RiskInsightsDataService,
  RiskInsightsReportService,
  SecurityTasksApiService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { RiskInsightsEncryptionService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/domain/risk-insights-encryption.service";
import { RiskInsightsOrchestratorService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/domain/risk-insights-orchestrator.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService as AccountServiceAbstraction } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { DefaultAdminTaskService } from "../../vault/services/default-admin-task.service";

import { AccessIntelligenceRoutingModule } from "./access-intelligence-routing.module";
import { NewApplicationsDialogComponent } from "./activity/application-review-dialog/new-applications-dialog.component";
import { RiskInsightsComponent } from "./risk-insights.component";
import { AccessIntelligenceSecurityTasksService } from "./shared/security-tasks.service";

@NgModule({
  imports: [RiskInsightsComponent, AccessIntelligenceRoutingModule, NewApplicationsDialogComponent],
  providers: [
    safeProvider(DefaultAdminTaskService),
    safeProvider({
      provide: MemberCipherDetailsApiService,
      useClass: MemberCipherDetailsApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: PasswordHealthService,
      useClass: PasswordHealthService,
      deps: [PasswordStrengthServiceAbstraction, AuditService],
    }),
    safeProvider({
      provide: RiskInsightsApiService,
      useClass: RiskInsightsApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: RiskInsightsReportService,
      useClass: RiskInsightsReportService,
      deps: [RiskInsightsApiService, RiskInsightsEncryptionService],
    }),
    safeProvider({
      provide: RiskInsightsOrchestratorService,
      deps: [
        AccountServiceAbstraction,
        CipherService,
        CriticalAppsService,
        LogService,
        MemberCipherDetailsApiService,
        OrganizationService,
        PasswordHealthService,
        RiskInsightsApiService,
        RiskInsightsReportService,
        RiskInsightsEncryptionService,
      ],
    }),
    safeProvider({
      provide: RiskInsightsDataService,
      deps: [RiskInsightsOrchestratorService],
    }),
    safeProvider({
      provide: RiskInsightsEncryptionService,
      deps: [KeyService, EncryptService, KeyGenerationService, LogService],
    }),
    safeProvider({
      provide: CriticalAppsService,
      useClass: CriticalAppsService,
      deps: [KeyService, EncryptService, CriticalAppsApiService],
    }),
    safeProvider({
      provide: CriticalAppsApiService,
      useClass: CriticalAppsApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: AllActivitiesService,
      useClass: AllActivitiesService,
      deps: [RiskInsightsDataService],
    }),
    safeProvider({
      provide: SecurityTasksApiService,
      useClass: SecurityTasksApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: AccessIntelligenceSecurityTasksService,
      useClass: AccessIntelligenceSecurityTasksService,
      deps: [AllActivitiesService, DefaultAdminTaskService, ToastService, I18nService],
    }),
  ],
})
export class AccessIntelligenceModule {}
