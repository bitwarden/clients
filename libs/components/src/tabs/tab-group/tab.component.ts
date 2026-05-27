import { TemplatePortal } from "@angular/cdk/portal";
import {
  Component,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  input,
  signal,
  viewChild,
  ChangeDetectionStrategy,
  inject,
  ElementRef,
} from "@angular/core";

import { PopoverElementProvider } from "../../popover";
import { BitwardenIcon } from "../../shared/icon";

/** Used to generate unique IDs for each tab component */
let nextTabId = 0;

@Component({
  selector: "bit-tab",
  templateUrl: "./tab.component.html",
  providers: [{ provide: PopoverElementProvider, useExisting: TabComponent }],
  host: {
    role: "tabpanel",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabComponent implements OnInit, PopoverElementProvider {
  readonly id = nextTabId++;

  readonly disabled = input(false);
  readonly textLabel = input("", { alias: "label" });
  readonly berryValue = input<number>();
  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();

  /** Popover anchor target. `TabGroupComponent` rebinds `nativeElement` to the rendered tab-list button. */
  readonly popoverAnchorElementRef: ElementRef<HTMLElement> = inject(ElementRef);
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
