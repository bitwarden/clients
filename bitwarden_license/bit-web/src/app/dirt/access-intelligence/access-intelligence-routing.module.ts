import { NgModule, inject } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { componentRouteSwap } from "@bitwarden/angular/utils/component-route-swap";
import {
  AccessIntelligenceDataService,
  AccessReportEncryptionService,
  CipherHealthService,
  DefaultAccessIntelligenceDataService,
  DefaultCipherHealthService,
  DefaultDrawerStateService,
  DefaultMemberCipherMappingService,
  DefaultReportGenerationService,
  DefaultReportPersistenceService,
  DrawerStateService,
  LegacyRiskInsightsEncryptionService,
  MemberCipherMappingService,
  ReportGenerationService,
  ReportPersistenceService,
} from "@bitwarden/bit-common/dirt/access-intelligence/services";
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
import { RiskInsightsOrchestratorService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/domain/risk-insights-orchestrator.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import {
  OrganizationService,
  canAccessAccessIntelligence,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService as AccountServiceAbstraction } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { AdminTaskService } from "../../vault/services/abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "../../vault/services/default-admin-task.service";

import { RiskInsightsComponent } from "./risk-insights.component";
import { DefaultRiskOverTimeService } from "./services/default-risk-over-time.service";
import { RiskOverTimeService } from "./services/risk-over-time.service";
import { AccessIntelligenceSecurityTasksService } from "./shared/security-tasks.service";
import { AccessIntelligencePageComponent } from "./v2/access-intelligence-page/access-intelligence-page.component";
import { AccessSecurityTasksService } from "./v2/services/abstractions/access-security-tasks.service";
import { DefaultAccessSecurityTasksService } from "./v2/services/implementations/default-access-security-tasks.service";

const v1Providers = [
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
    provide: PasswordHealthService,
    useClass: PasswordHealthService,
    deps: [AuditService, PasswordStrengthServiceAbstraction],
  }),
  safeProvider({
    provide: LegacyRiskInsightsEncryptionService,
    deps: [KeyService, EncryptService, KeyGenerationService, LogService],
  }),
  safeProvider({
    provide: RiskInsightsReportService,
    useClass: RiskInsightsReportService,
    deps: [RiskInsightsApiService, LegacyRiskInsightsEncryptionService],
  }),
  safeProvider({
    provide: CriticalAppsService,
    useClass: CriticalAppsService,
    deps: [KeyService, EncryptService, CriticalAppsApiService],
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
      LegacyRiskInsightsEncryptionService,
    ],
  }),
  safeProvider({
    provide: RiskInsightsDataService,
    deps: [RiskInsightsOrchestratorService],
  }),
  safeProvider({
    provide: AllActivitiesService,
    useClass: AllActivitiesService,
    deps: [RiskInsightsDataService],
  }),
  safeProvider({
    provide: AccessIntelligenceSecurityTasksService,
    useClass: AccessIntelligenceSecurityTasksService,
    deps: [DefaultAdminTaskService, SecurityTasksApiService, RiskInsightsDataService],
  }),
  safeProvider({
    provide: RiskOverTimeService,
    useClass: DefaultRiskOverTimeService,
    deps: [
      RiskInsightsApiService,
      AccessReportEncryptionService,
      AccountServiceAbstraction,
      LogService,
    ],
  }),
];

const v2Providers = [
  safeProvider({
    provide: AdminTaskService,
    useExisting: DefaultAdminTaskService,
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
    provide: AccessIntelligenceDataService,
    useClass: DefaultAccessIntelligenceDataService,
    deps: [
      CipherService,
      OrganizationUserApiService,
      ReportGenerationService,
      ReportPersistenceService,
      LogService,
    ],
  }),
  safeProvider({
    provide: DrawerStateService,
    useClass: DefaultDrawerStateService,
    deps: [],
  }),
  safeProvider({
    provide: AccessSecurityTasksService,
    useClass: DefaultAccessSecurityTasksService,
    deps: [AdminTaskService, SecurityTasksApiService, AccessIntelligenceDataService],
  }),
];

const sharedRouteOptions = {
  path: "",
  canActivate: [organizationPermissionsGuard(canAccessAccessIntelligence)],
  data: {
    titleId: "accessIntelligence",
  },
};

const canMatch$ = () =>
  inject(ConfigService)
    .getFeatureFlag$(FeatureFlag.AccessIntelligenceNewArchitecture)
    .pipe(map((flagValue) => flagValue === true));

const routes: Routes = [
  ...componentRouteSwap(
    RiskInsightsComponent,
    AccessIntelligencePageComponent,
    canMatch$,
    { ...sharedRouteOptions, providers: v1Providers },
    { ...sharedRouteOptions, providers: v2Providers },
  ),
  {
    path: "risk-insights",
    redirectTo: "",
    pathMatch: "full",
    // Backwards compatibility: redirect old "risk-insights" route to new base route
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessIntelligenceRoutingModule {}
