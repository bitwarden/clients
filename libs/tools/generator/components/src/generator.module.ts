import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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

import { CatchallSettingsComponent } from "./catchall-settings.component";
import { CredentialGeneratorComponent } from "./credential-generator.component";
import { ForwarderSettingsComponent } from "./forwarder-settings.component";
import { GeneratorServicesModule } from "./generator-services.module";
import { NudgeGeneratorSpotlightComponent } from "./nudge-generator-spotlight.component";
import { PassphraseSettingsComponent } from "./passphrase-settings.component";
import { PasswordGeneratorComponent } from "./password-generator.component";
import { PasswordSettingsComponent } from "./password-settings.component";
import { SubaddressSettingsComponent } from "./subaddress-settings.component";
import { UsernameGeneratorComponent } from "./username-generator.component";
import { UsernameSettingsComponent } from "./username-settings.component";

/** Shared module containing generator component dependencies */
@NgModule({
  imports: [
    CardComponent,
    ColorPasswordModule,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    GeneratorServicesModule,
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
    NudgeGeneratorSpotlightComponent,
  ],
  declarations: [
    CatchallSettingsComponent,
    CredentialGeneratorComponent,
    ForwarderSettingsComponent,
    SubaddressSettingsComponent,
    PasswordGeneratorComponent,
    PassphraseSettingsComponent,
    PasswordSettingsComponent,
    UsernameGeneratorComponent,
    UsernameSettingsComponent,
  ],
  exports: [CredentialGeneratorComponent, PasswordGeneratorComponent, UsernameGeneratorComponent],
})
export class GeneratorModule {
  constructor() {}
}
