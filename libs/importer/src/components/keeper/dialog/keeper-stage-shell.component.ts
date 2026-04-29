import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, IconButtonModule } from "@bitwarden/components";

@Component({
  selector: "keeper-stage-shell",
  templateUrl: "keeper-stage-shell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, ButtonModule, DialogModule, IconButtonModule],
})
export class KeeperStageShellComponent {
  readonly title = input.required<string>();
  readonly email = input<string>("");

  readonly close = output<void>();
}
