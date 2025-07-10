import { NgModule } from "@angular/core";

import { GeneratorServicesModule } from "@bitwarden/generator-components";

import { SendFormService } from "./abstractions/send-form.service";
import { SendFormComponent } from "./components/send-form.component";
import { DefaultSendFormService } from "./services/default-send-form.service";

@NgModule({
  imports: [SendFormComponent, GeneratorServicesModule],
  providers: [
    {
      provide: SendFormService,
      useClass: DefaultSendFormService,
    },
  ],
  exports: [SendFormComponent],
})
export class SendFormModule {}
