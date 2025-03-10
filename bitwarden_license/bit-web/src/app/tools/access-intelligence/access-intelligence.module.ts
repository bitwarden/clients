import { NgModule } from "@angular/core";

import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { CriticalAppsService } from "@bitwarden/bit-common/tools/reports/risk-insights";
import {
  CriticalAppsApiService,
  MemberCipherDetailsApiService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights/services";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
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
    {
      provide: RiskInsightsReportService,
      deps: [
        PasswordStrengthServiceAbstraction,
        AuditService,
        CipherService,
        MemberCipherDetailsApiService,
      ],
    },
    {
      provide: RiskInsightsDataService,
      deps: [RiskInsightsReportService],
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
  ],
})
export class AccessIntelligenceModule {}
