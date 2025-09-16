import { NgModule } from "@angular/core";

import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import {
  CriticalAppsApiService,
  MemberCipherDetailsApiService,
  PasswordHealthService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { CriticalAppsService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/critical-apps.service";
import { RiskInsightsApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/risk-insights-api.service";
import { RiskInsightsEncryptionService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services/risk-insights-encryption.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { KeyService } from "@bitwarden/key-management";

import { AccessIntelligenceRoutingModule } from "./access-intelligence-routing.module";
import { RiskInsightsComponent } from "./risk-insights.component";

@NgModule({
  imports: [RiskInsightsComponent, AccessIntelligenceRoutingModule],
  providers: [
    {
      provide: MemberCipherDetailsApiService,
      deps: [ApiService],
    },
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
    { provide: PasswordHealthService, deps: [PasswordStrengthServiceAbstraction, AuditService] },
    {
      provide: RiskInsightsApiService,
    },
    {
      provide: RiskInsightsReportService,
      deps: [
        CipherService,
        MemberCipherDetailsApiService,
        PasswordHealthService,
        RiskInsightsApiService,
        RiskInsightsEncryptionService,
      ],
    },
    {
      provide: RiskInsightsDataService,
      deps: [
        AccountService,
        CriticalAppsService,
        OrganizationService,
        RiskInsightsReportService,
        LogService,
      ],
    },
    {
      provide: RiskInsightsEncryptionService,
      useClass: RiskInsightsEncryptionService,
      deps: [KeyService, EncryptService, KeyGenerationService],
    },
  ],
})
export class AccessIntelligenceModule {}
