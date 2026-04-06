import { NgModule } from "@angular/core";

import { UserKeyRotationApiService } from "./user-key-rotation-api.service";
import { UserKeyRotationService } from "./user-key-rotation.service";

@NgModule({
  providers: [UserKeyRotationService, UserKeyRotationApiService],
})
export class UserKeyRotationModule {}
