import { ChangeDetectionStrategy, Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService, TypographyModule } from "@bitwarden/components";

@Component({
  templateUrl: "keeper-dna-push-prompt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperDnaPushPromptComponent {
  static open(dialogService: DialogService) {
    return dialogService.open<string>(KeeperDnaPushPromptComponent);
  }
}
