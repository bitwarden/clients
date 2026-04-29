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

  // bit-dialog gates its footer area on contentChild(DialogFooterDirective). When
  // the footer is projected through this wrapper via ngProjectAs, the directive
  // doesn't actually attach to the placeholder, so we need an explicit flag and
  // re-emit a real <ng-container bitDialogFooter>. Defaults true; pass false on
  // stages that don't render footer buttons.
  readonly hasFooter = input<boolean>(true);

  readonly close = output<void>();
}
