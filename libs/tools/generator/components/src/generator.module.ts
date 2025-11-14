import { NgModule } from "@angular/core";

import { CredentialGeneratorComponent } from "./credential-generator.component";
import { PasswordGeneratorComponent } from "./password-generator.component";
import { UsernameGeneratorComponent } from "./username-generator.component";

/** Shared module containing generator component dependencies */
/** @deprecated Use individual components instead. */
@NgModule({
  imports: [CredentialGeneratorComponent, PasswordGeneratorComponent, UsernameGeneratorComponent],
  exports: [CredentialGeneratorComponent, PasswordGeneratorComponent, UsernameGeneratorComponent],
})
export class GeneratorModule {
  constructor() {}
}
