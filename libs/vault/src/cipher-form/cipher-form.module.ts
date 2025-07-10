import { NgModule } from "@angular/core";

import { CipherFormGenerationService } from "./abstractions/cipher-form-generation.service";
import { CipherFormService } from "./abstractions/cipher-form.service";
import { CipherFormComponent } from "./components/cipher-form.component";
import { DefaultCipherFormGenerationService } from "./services/default-cipher-form-generation.service";
import { DefaultCipherFormService } from "./services/default-cipher-form.service";

@NgModule({
  imports: [CipherFormComponent],
  providers: [
    {
      provide: CipherFormService,
      useClass: DefaultCipherFormService,
    },
    {
      provide: CipherFormGenerationService,
      useClass: DefaultCipherFormGenerationService,
    },
  ],
  exports: [CipherFormComponent],
})
export class CipherFormModule {}
