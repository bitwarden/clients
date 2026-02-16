import { Component, ChangeDetectionStrategy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { InfoFilledIcon } from "@bitwarden/assets/svg";
import { PopoverModule, IconModule, ButtonModule, SvgModule } from "@bitwarden/components";

@Component({
  selector: "app-simplified-autofill-info",
  templateUrl: "./simplified-autofill-info.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, PopoverModule, IconModule, ButtonModule, SvgModule],
})
export class SimplifiedAutofillInfoComponent {
  protected readonly InfoFilledIcon = InfoFilledIcon;
}
