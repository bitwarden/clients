import { NgModule } from "@angular/core";

import { CipherFormService } from "./abstractions/cipher-form.service";
import { CipherFormComponent } from "./components/cipher-form.component";
import { DefaultCipherFormService } from "./services/default-cipher-form.service";

@NgModule({
  imports: [CipherFormComponent],
  providers: [
    {
      provide: CipherFormService,
      useClass: DefaultCipherFormService,
    },
  ],
  exports: [CipherFormComponent],
})
export class CipherFormModule {}
