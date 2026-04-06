import { NgFor, NgIf } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { MagnifyAction } from "../../../../autofill/models/magnify-actions";
import { MAGNIFY_PLATFORM } from "../../utils/magnify-platform";

@Component({
  selector: "action-bar",
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: "./action-bar.component.html",
  styleUrl: "./action-bar.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionBarComponent {
  readonly actions = input<MagnifyAction[]>([]);

  getLabel(action: MagnifyAction): string {
    switch (MAGNIFY_PLATFORM) {
      case "darwin":
        return action.labelMacOs;
      case "win32":
        return action.labelWindows;
      case "linux":
        return action.labelLinux;
      default:
        return action.labelWindows;
    }
  }
}
