import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { StateProvider } from "@bitwarden/common/platform/state";
import {
  CardComponent,
  ColorPasswordModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  InputModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";
import {
  createRandomizer,
  CredentialGeneratorService,
  Randomizer,
} from "@bitwarden/generator-core";
import { KeyService } from "@bitwarden/key-management";

import { CatchallSettingsComponent } from "./catchall-settings.component";
import { CredentialGeneratorComponent } from "./credential-generator.component";
import { PassphraseSettingsComponent } from "./passphrase-settings.component";
import { PasswordGeneratorComponent } from "./password-generator.component";
import { PasswordSettingsComponent } from "./password-settings.component";
import { SubaddressSettingsComponent } from "./subaddress-settings.component";
import { UsernameGeneratorComponent } from "./username-generator.component";
import { UsernameSettingsComponent } from "./username-settings.component";

const RANDOMIZER = new SafeInjectionToken<Randomizer>("Randomizer");

/** Shared module containing generator component dependencies */
@NgModule({
  imports: [
    CardComponent,
    ColorPasswordModule,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    IconButtonModule,
    InputModule,
    ItemModule,
    JslibModule,
    ReactiveFormsModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    ToggleGroupModule,
    TypographyModule,
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
  declarations: [
    CatchallSettingsComponent,
    CredentialGeneratorComponent,
    SubaddressSettingsComponent,
    UsernameSettingsComponent,
    PasswordGeneratorComponent,
    PasswordSettingsComponent,
    PassphraseSettingsComponent,
    UsernameGeneratorComponent,
  ],
  exports: [CredentialGeneratorComponent, PasswordGeneratorComponent, UsernameGeneratorComponent],
})
export class GeneratorModule {
  constructor() {}
}
