import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { StateProvider } from "@bitwarden/common/platform/state";
import {
  CardComponent,
  CheckboxModule,
  ColorPasswordModule,
  FormFieldModule,
  IconButtonModule,
  InputModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  ToggleGroupModule,
} from "@bitwarden/components";
import {
  createRandomizer,
  CredentialGeneratorService,
  Randomizer,
} from "@bitwarden/generator-core";
import { KeyService } from "@bitwarden/key-management";

const RANDOMIZER = new SafeInjectionToken<Randomizer>("Randomizer");

/** Shared module containing generator component dependencies */
@NgModule({
  imports: [CardComponent, SectionComponent, SectionHeaderComponent],
  exports: [
    CardComponent,
    CheckboxModule,
    CommonModule,
    ColorPasswordModule,
    FormFieldModule,
    IconButtonModule,
    InputModule,
    ItemModule,
    JslibModule,
    JslibServicesModule,
    ReactiveFormsModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    ToggleGroupModule,
  ],
  providers: [
    safeProvider({
      provide: RANDOMIZER,
      useFactory: createRandomizer,
      deps: [KeyService],
    }),
    safeProvider({
      provide: CredentialGeneratorService,
      useClass: CredentialGeneratorService,
      deps: [RANDOMIZER, StateProvider, PolicyService],
    }),
  ],
  declarations: [],
})
export class DependenciesModule {
  constructor() {}
}
