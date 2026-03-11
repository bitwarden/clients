import { NgModule } from "@angular/core";

import { GeneratorServicesModule } from "@bitwarden/generator-components";

import { SendFormGenerationService } from "./abstractions/send-form-generation.service";
import { SendFormService } from "./abstractions/send-form.service";
import { SendFormComponent } from "./components/send-form.component";
import { DefaultSendFormGenerationService } from "./services/default-send-form-generation.service";
import { DefaultSendFormService } from "./services/default-send-form.service";

@NgModule({
  imports: [SendFormComponent, GeneratorServicesModule],
  providers: [
    {
      provide: SendFormService,
      useClass: DefaultSendFormService,
    },
    {
      provide: SendFormGenerationService,
      useClass: DefaultSendFormGenerationService,
    },
  ],
  exports: [SendFormComponent],
})
export class SendFormModule {}
