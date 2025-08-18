import { TemplatePortal } from "@angular/cdk/portal";
import {
  Component,
  ContentChild,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  input,
  viewChild,
} from "@angular/core";

import { TabLabelDirective } from "./tab-label.directive";

@Component({
  selector: "bit-tab",
  templateUrl: "./tab.component.html",
  host: {
    role: "tabpanel",
  },
})
export class TabComponent implements OnInit {
  readonly disabled = input(false);
  readonly textLabel = input("", { alias: "label" });

  /**
   * Optional tabIndex for the tabPanel that contains this tab's content.
   *
   * If the tabpanel does not contain any focusable elements or the first element with content is not focusable,
   * this should be set to 0 to include it in the tab sequence of the page.
   *
   * @remarks See note 4 of https://www.w3.org/WAI/ARIA/apg/patterns/tabpanel/
   */
  readonly contentTabIndex = input<number | undefined>();

  readonly implicitContent = viewChild.required(TemplateRef);
  @ContentChild(TabLabelDirective) templateLabel?: TabLabelDirective;

  private _contentPortal: TemplatePortal | null = null;

  get content(): TemplatePortal | null {
    return this._contentPortal;
  }

  isActive?: boolean;

  constructor(private _viewContainerRef: ViewContainerRef) {}

  ngOnInit(): void {
    this._contentPortal = new TemplatePortal(this.implicitContent(), this._viewContainerRef);
  }
}
