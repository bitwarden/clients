import { Component, ChangeDetectionStrategy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PopoverModule, IconModule, ButtonModule } from "@bitwarden/components";

@Component({
  selector: "app-simplified-autofill-info",
  templateUrl: "./simplified-autofill-info.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, PopoverModule, IconModule, ButtonModule],
})
export class SimplifiedAutofillInfoComponent {}
