// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TemplatePortal, CdkPortalOutlet } from "@angular/cdk/portal";
import { Component, HostBinding, Input } from "@angular/core";

@Component({
  selector: "bit-tab-body",
  templateUrl: "tab-body.component.html",
  standalone: true,
  imports: [CdkPortalOutlet],
})
export class TabBodyComponent {
  private _firstRender: boolean;

  @Input() content: TemplatePortal;
  @Input() preserveContent = false;

  @HostBinding("attr.hidden") get hidden() {
    return !this.active || null;
  }

  @Input()
  get active() {
    return this._active;
  }
  set active(value: boolean) {
    this._active = value;
    if (this._active) {
      this._firstRender = true;
    }
  }
  private _active: boolean;

  /**
   * The tab content to render.
   * Inactive tabs that have never been rendered/active do not have their
   * content rendered by default for performance. If `preserveContent` is `true`
   * then the content persists after the first time content is rendered.
   */
  get tabContent() {
    if (this.active) {
      return this.content;
    }
    if (this.preserveContent && this._firstRender) {
      return this.content;
    }
    return null;
  }
}
