import { TemplatePortal, CdkPortalOutlet } from "@angular/cdk/portal";
import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from "@angular/core";

@Component({
  selector: "bit-tab-body",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "tab-body.component.html",
  imports: [CdkPortalOutlet],
  host: {
    "[attr.hidden]": "active() ? null : true",
  },
})
export class TabBodyComponent {
  readonly content = input<TemplatePortal>();
  readonly preserveContent = input(false);

  readonly active = input<boolean>();

  /** Latches to `true` the first time the tab becomes active. */
  private readonly hasBeenActive = linkedSignal<boolean | undefined, boolean>({
    source: this.active,
    computation: (active, previous) => !!active || !!previous?.value,
  });

  /**
   * The tab content to render.
   * Inactive tabs that have never been rendered/active do not have their
   * content rendered by default for performance. If `preserveContent` is `true`
   * then the content persists after the first time content is rendered.
   */
  protected readonly tabContent = computed(() => {
    // Read unconditionally so the latch observes every change to `active`.
    const hasBeenActive = this.hasBeenActive();
    if (this.active()) {
      return this.content();
    }
    if (this.preserveContent() && hasBeenActive) {
      return this.content();
    }
    return null;
  });
}
