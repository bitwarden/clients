import { NgModule } from "@angular/core";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { safeProvider } from "@bitwarden/ui-common";

import { DefaultUserKeyRotationService } from "./user-key-rotation.service";
import { UserKeyRotationService } from "./user-key-rotation.service.abstraction";

/**
 * Angular module that provides user crypto management services.
 * This module handles key rotation and trust verification for organizations
 * and emergency access users.
 */
@NgModule({
  providers: [
    safeProvider({
      provide: UserKeyRotationService,
      useClass: DefaultUserKeyRotationService,
      deps: [SdkService, LogService, DialogService],
    }),
  ],
})
export class UserCryptoManagementModule {}
