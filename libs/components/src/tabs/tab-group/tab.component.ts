import { TemplatePortal } from "@angular/cdk/portal";
import {
  Component,
  ContentChild,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  input,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from "@angular/core";

import { BitwardenIcon } from "../../shared/icon";

import { TabLabelDirective } from "./tab-label.directive";

@Component({
  selector: "bit-tab",
  templateUrl: "./tab.component.html",
  host: {
    role: "tabpanel",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabComponent implements OnInit {
  readonly disabled = input(false);
  readonly textLabel = input("", { alias: "label" });
  readonly berryValue = input<number>();
  readonly trailingIcon = input<BitwardenIcon>();

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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ContentChild(TabLabelDirective) templateLabel?: TabLabelDirective;

  private readonly _contentPortal = signal<TemplatePortal | null>(null);

  get content(): TemplatePortal | null {
    return this._contentPortal();
  }

  readonly isActive = signal(false);

  constructor(private readonly _viewContainerRef: ViewContainerRef) {}

  ngOnInit(): void {
    this._contentPortal.set(new TemplatePortal(this.implicitContent(), this._viewContainerRef));
  }
}
