import { NgModule } from "@angular/core";

import {
  MemberCipherDetailsApiService,
  RiskInsightsDataService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights/services";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

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
  ],
})
export class AccessIntelligenceModule {}
