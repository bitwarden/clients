import { NgModule } from "@angular/core";

import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import {
  createRandomizer,
  CredentialGeneratorService,
  Randomizer,
} from "@bitwarden/generator-core";

import { SshKeyNativeGenerator } from "../../../../generator/core/src/abstractions/sshkey-native-generator.abstraction";
import { NoopSshKeyGeneratorService } from "../../../../generator/core/src/services/noop-sshkey-native-generator.service";

import { SendFormService } from "./abstractions/send-form.service";
import { SendFormComponent } from "./components/send-form.component";
import { DefaultSendFormService } from "./services/default-send-form.service";

const RANDOMIZER = new SafeInjectionToken<Randomizer>("Randomizer");

@NgModule({
  imports: [SendFormComponent],
  providers: [
    {
      provide: SendFormService,
      useClass: DefaultSendFormService,
    },
    safeProvider({
      provide: RANDOMIZER,
      useFactory: createRandomizer,
      deps: [CryptoService],
    }),
    safeProvider({
      provide: SshKeyNativeGenerator,
      useClass: NoopSshKeyGeneratorService,
      deps: [],
    }),
    safeProvider({
      useClass: CredentialGeneratorService,
      provide: CredentialGeneratorService,
      deps: [RANDOMIZER, StateProvider, PolicyService, SshKeyNativeGenerator],
    }),
  ],
  exports: [SendFormComponent],
})
export class SendFormModule {}
