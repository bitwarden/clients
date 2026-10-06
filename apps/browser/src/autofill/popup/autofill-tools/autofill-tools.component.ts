import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule } from "@bitwarden/components";

import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { AutofillTriageComponent } from "../autofill-triage/autofill-triage.component";
import { WebmapperComponent } from "../webmapper/webmapper.component";

type ToolsView = "triage" | "webmapper";

/**
 * Shell for the complementary autofill authoring tools — Triage and Webmapper —
 * sharing one side-panel surface and the fillAssistDevTools dev flag. Both views
 * stay mounted and are toggled by visibility (not destroyed) so each keeps its
 * live state across switches. The initial view is chosen by the `view` query
 * param the opening context-menu item sets.
 */
@Component({
  selector: "app-autofill-tools",
  templateUrl: "autofill-tools.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    AutofillTriageComponent,
    WebmapperComponent,
  ],
})
export class AutofillToolsComponent implements OnInit {
  readonly view = signal<ToolsView>("triage");

  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get("view") === "webmapper") {
      this.view.set("webmapper");
    }
  }

  select(view: ToolsView) {
    this.view.set(view);
  }
}
