import { TemplatePortal } from "@angular/cdk/portal";
import { Component, Input, OnInit, TemplateRef, ViewChild, ViewContainerRef } from "@angular/core";

@Component({
  selector: "vault-carousel-slide",
  templateUrl: "./carousel-slide.component.html",
  standalone: true,
})
export class VaultCarouselSlideComponent implements OnInit {
  /**
   * Optional tabIndex for the tabPanel that contains this tab's content.
   *
   * If the tabpanel does not contain any focusable elements or the first element with content is not focusable,
   * this should be set to 0 to include it in the tab sequence of the page.
   *
   * @remarks See note 4 of https://www.w3.org/WAI/ARIA/apg/patterns/tabpanel/
   */
  @Input() contentTabIndex: number | undefined;

  @ViewChild(TemplateRef, { static: true }) implicitContent!: TemplateRef<unknown>;

  private _contentPortal: TemplatePortal | null = null;

  get content(): TemplatePortal | null {
    return this._contentPortal;
  }

  constructor(private _viewContainerRef: ViewContainerRef) {}

  ngOnInit(): void {
    this._contentPortal = new TemplatePortal(this.implicitContent, this._viewContainerRef);
  }
}
