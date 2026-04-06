import { NgModule } from "@angular/core";

import { EmergencyAccessApiService } from "./services/emergency-access-api.service";
import { EmergencyAccessService } from "./services/emergency-access.service";

@NgModule({
  declarations: [],
  imports: [],
  providers: [EmergencyAccessApiService, EmergencyAccessService],
})
export class EmergencyAccessModule {}
