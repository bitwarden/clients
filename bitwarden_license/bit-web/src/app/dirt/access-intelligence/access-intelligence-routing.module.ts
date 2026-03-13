import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { componentRouteSwap } from "@bitwarden/angular/utils/component-route-swap";
import {
  AccessIntelligenceDataService,
  AccessReportEncryptionService,
  ApplicationVersioningService,
  CipherHealthService,
  DefaultAccessIntelligenceDataService,
  DefaultAccessReportEncryptionService,
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
  ReportVersioningService,
  SummaryVersioningService,
} from "@bitwarden/bit-common/dirt/access-intelligence/services";
import {
  AllActivitiesService,
  CriticalAppsService,
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
  canAccessAccessIntelligence,
  OrganizationService,
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

import { DefaultAdminTaskService } from "../../vault/services/default-admin-task.service";

import { RiskInsightsComponent } from "./risk-insights.component";
import { AccessIntelligencePageComponent } from "./v2/access-intelligence-page/access-intelligence-page.component";
import { SecurityTasksService } from "./v2/services/abstractions/security-tasks.service";
import { DefaultSecurityTasksService } from "./v2/services/implementations/default-security-tasks.service";
import { LegacySecurityTasksService } from "./v2/services/implementations/legacy-security-tasks.service";

// Providers scoped to the V1 route (RiskInsightsComponent and its descendants).
// LegacySecurityTasksService is bound to the SecurityTasksService abstract so that
// all V1 components injecting SecurityTasksService receive the legacy implementation.
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
    provide: SecurityTasksService,
    useClass: LegacySecurityTasksService,
    deps: [DefaultAdminTaskService, SecurityTasksApiService, RiskInsightsDataService],
  }),
  safeProvider({
    provide: LegacyRiskInsightsEncryptionService,
    deps: [KeyService, EncryptService, KeyGenerationService, LogService],
  }),
  safeProvider({
    provide: CriticalAppsService,
    useClass: CriticalAppsService,
    deps: [KeyService, EncryptService, CriticalAppsApiService],
  }),
  safeProvider({
    provide: PasswordHealthService,
    useClass: PasswordHealthService,
    deps: [AuditService, PasswordStrengthServiceAbstraction],
  }),
  safeProvider({
    provide: RiskInsightsReportService,
    useClass: RiskInsightsReportService,
    deps: [RiskInsightsApiService, LegacyRiskInsightsEncryptionService],
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
];

// Providers scoped to the V2 route (AccessIntelligencePageComponent and its descendants).
// DefaultSecurityTasksService is bound to the SecurityTasksService abstract so that
// all V2 components injecting SecurityTasksService receive the V2 implementation.
// V1-only services (RiskInsightsOrchestratorService, RiskInsightsDataService, etc.) are
// intentionally omitted — V2 uses AccessIntelligenceDataService instead.
const v2Providers = [
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
    provide: LegacyRiskInsightsEncryptionService,
    deps: [KeyService, EncryptService, KeyGenerationService, LogService],
  }),
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
    provide: SecurityTasksService,
    useClass: DefaultSecurityTasksService,
    deps: [DefaultAdminTaskService, SecurityTasksApiService, AccessIntelligenceDataService],
  }),
];

// Replicates the canMatch guard from featureFlaggedRoute — evaluates the feature flag at
// navigation time to determine whether the V2 route should be matched.
const canMatchV2 = () =>
  inject(ConfigService)
    .getFeatureFlag$(FeatureFlag.AccessIntelligenceNewArchitecture)
    .pipe(map((flagValue) => flagValue === true));

const sharedRouteOptions = {
  path: "",
  canActivate: [organizationPermissionsGuard(canAccessAccessIntelligence)],
  data: { titleId: "accessIntelligence" },
};

const routes: Routes = [
  // componentRouteSwap puts the V2 route first so it is evaluated before V1.
  // V2 matches only when canMatchV2 returns true (feature flag ON).
  // V1 is the fallback when the flag is OFF.
  ...componentRouteSwap(
    RiskInsightsComponent, // V1 (default, flag OFF)
    AccessIntelligencePageComponent, // V2 (flagged, flag ON)
    canMatchV2,
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
