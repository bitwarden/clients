import { Component } from "@angular/core";
import { Observable } from "rxjs";

import { HasNudgeService } from "@bitwarden/vault";

@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
  providers: [HasNudgeService],
})
export class TabsV2Component {
  showBerry$: Observable<boolean>;

  constructor(private readonly hasNudgeService: HasNudgeService) {
    this.showBerry$ = this.hasNudgeService.shouldShowNudge$();
  }
}
