import { NgModule } from "@angular/core";

import {
  CriticalAppsApiService,
  criticalServiceFactoryProvider,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { KeyService } from "@bitwarden/key-management";

import { AccessIntelligenceRoutingModule } from "./access-intelligence-routing.module";
import { RiskInsightsComponent } from "./risk-insights.component";

@NgModule({
  imports: [RiskInsightsComponent, AccessIntelligenceRoutingModule],
  providers: [
    {
      provide: CriticalAppsApiService,
      useFactory: criticalServiceFactoryProvider,
      deps: [ApiService, KeyService, EncryptService],
    },
  ],
})
export class AccessIntelligenceModule {}
