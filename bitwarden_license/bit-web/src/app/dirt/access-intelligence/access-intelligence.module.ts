import { NgModule } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { CriticalAppsService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  AccessIntelligenceDataService,
  AllActivitiesService,
  CipherHealthService,
  CriticalAppsApiService,
  DefaultAccessIntelligenceDataService,
  DefaultCipherHealthService,
  DefaultDrawerStateService,
  DefaultLegacyReportMigrationService,
  DefaultMemberCipherMappingService,
  DefaultReportGenerationService,
  DefaultReportPersistenceService,
  DefaultAccessReportEncryptionService,
  DrawerStateService,
  LegacyReportMigrationService,
  MemberCipherDetailsApiService,
  MemberCipherMappingService,
  PasswordHealthService,
  ReportGenerationService,
  ReportPersistenceService,
  RiskInsightsApiService,
  RiskInsightsDataService,
  RiskInsightsReportService,
  SecurityTasksApiService,
  RiskInsightsEncryptionService,
  AccessReportEncryptionService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { RiskInsightsOrchestratorService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/domain/risk-insights-orchestrator.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService as AccountServiceAbstraction } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { DefaultAdminTaskService } from "../../vault/services/default-admin-task.service";

import { AccessIntelligenceRoutingModule } from "./access-intelligence-routing.module";
import { NewApplicationsDialogComponent } from "./activity/application-review-dialog/new-applications-dialog.component";
import { RiskInsightsComponent } from "./risk-insights.component";
import { AccessIntelligenceSecurityTasksService } from "./shared/security-tasks.service";
// AccessIntelligencePageComponent loaded via routing - no import needed

@NgModule({
  imports: [
    // Routing
    AccessIntelligenceRoutingModule,

    // V1 root component (keep until migration complete)
    RiskInsightsComponent,

    // V2 root component loaded via routing (no import needed - standalone component)
    // AccessIntelligencePageComponent is loaded by featureFlaggedRoute in routing module

    // Shared components (reused by both V1 and V2)
    NewApplicationsDialogComponent,

    // Note: Child components (AllApplications, CriticalApplications, etc.) are imported
    // directly by their parent root components, not by this module
  ],
  providers: [
    safeProvider({
      provide: CriticalAppsApiService,
      useClass: CriticalAppsApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: MemberCipherDetailsApiService,
      useClass: MemberCipherDetailsApiService,
      deps: [ApiService],
    }),
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
      provide: AccessIntelligenceSecurityTasksService,
      useClass: AccessIntelligenceSecurityTasksService,
      deps: [DefaultAdminTaskService, SecurityTasksApiService, RiskInsightsDataService],
    }),
    safeProvider({
      provide: PasswordHealthService,
      useClass: PasswordHealthService,
      deps: [AuditService, PasswordStrengthServiceAbstraction],
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
      provide: AccessReportEncryptionService,
      useClass: DefaultAccessReportEncryptionService,
      deps: [KeyService, EncryptService, KeyGenerationService, LogService],
    }),
    safeProvider({
      provide: CriticalAppsService,
      useClass: CriticalAppsService,
      deps: [KeyService, EncryptService, CriticalAppsApiService],
    }),
    safeProvider({
      provide: AllActivitiesService,
      useClass: AllActivitiesService,
      deps: [RiskInsightsDataService],
    }),
    // V2 Services (Access Intelligence new architecture)
    safeProvider({
      provide: LegacyReportMigrationService,
      useClass: DefaultLegacyReportMigrationService,
      deps: [
        RiskInsightsApiService,
        RiskInsightsEncryptionService,
        AccountServiceAbstraction,
        LogService,
      ],
    }),
    safeProvider({
      provide: AccessIntelligenceDataService,
      useClass: DefaultAccessIntelligenceDataService,
      deps: [
        CipherService,
        OrganizationUserApiService,
        ReportGenerationService,
        ReportPersistenceService,
        LegacyReportMigrationService,
        LogService,
      ],
    }),
    safeProvider({
      provide: DrawerStateService,
      useClass: DefaultDrawerStateService,
      deps: [],
    }),
    safeProvider({
      provide: ReportGenerationService,
      useClass: DefaultReportGenerationService,
      deps: [CipherHealthService, MemberCipherMappingService, LogService],
    }),
    safeProvider({
      provide: ReportPersistenceService,
      useClass: DefaultReportPersistenceService,
      deps: [
        RiskInsightsApiService,
        AccessReportEncryptionService,
        AccountServiceAbstraction,
        LogService,
      ],
    }),
    safeProvider({
      provide: CipherHealthService,
      useClass: DefaultCipherHealthService,
      deps: [AuditService, PasswordStrengthServiceAbstraction],
    }),
    safeProvider({
      provide: MemberCipherMappingService,
      useClass: DefaultMemberCipherMappingService,
      deps: [],
    }),
  ],
})
export class AccessIntelligenceModule {}
