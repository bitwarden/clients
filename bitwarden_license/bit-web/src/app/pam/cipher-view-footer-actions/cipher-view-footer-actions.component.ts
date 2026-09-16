import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AsyncActionsModule, ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RequestAccessFooterBridge } from "../cipher-view-banner/request-access-footer.bridge";

/**
 * The LEFT-slotted actions in the vault item dialog's footer for a PAM-governed cipher — bound to
 * `CIPHER_VIEW_FOOTER_ACTIONS` (`@bitwarden/vault`) alongside `CIPHER_VIEW_BANNER`.
 *
 * The card ({@link CipherViewBannerComponent}) owns the form; this component owns only the
 * buttons that drive it, reading the handle the card publishes through
 * {@link RequestAccessFooterBridge}.
 *
 * Renders nothing when no handle is published, when the published handle belongs to a DIFFERENT
 * cipher (one left over from a previously open item), or when the matching handle reports itself
 * not visible — an ordinary cipher's dialog footer must be untouched.
 */
@Component({
  selector: "app-pam-cipher-view-footer-actions",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./cipher-view-footer-actions.component.html",
  imports: [AsyncActionsModule, ButtonModule, I18nPipe],
})
export class CipherViewFooterActionsComponent {
  readonly cipher = input.required<CipherView>();

  private readonly bridge = inject(RequestAccessFooterBridge);
  private readonly injector = inject(Injector);

  /**
   * The handle to render actions from, or null for a footer with nothing to add.
   *
   * Null unless the published handle both matches the cipher this footer was handed — a stale
   * handle from a previously open item must render nothing rather than drive the wrong request —
   * and reports itself visible, so the template branches on the open form alone.
   */
  protected readonly handle = computed(() => {
    const actions = this.bridge.actions();
    const cipherId = this.cipher().id;

    if (actions == null || cipherId == null || actions.cipherId !== cipherId) {
      return null;
    }

    return actions.visible() ? actions : null;
  });

  /** Refocused once the form collapses — see the constructor effect below. */
  private readonly requestToggleButton = viewChild("requestToggleButton", {
    read: ElementRef<HTMLElement>,
  });

  constructor() {
    // Collapsing (this footer's Cancel, or a submit that closed the form on the card's side)
    // unmounts [Submit request]/[Cancel] and remounts [Request access]; refocus it so a keyboard
    // caller is not dropped at the top of the dialog. Keyed off the collapse EDGE — the resting
    // state is also unexpanded, and refocusing on every render would steal focus on open. Keep
    // `effect` + `afterNextRender`: `afterRenderEffect` runs only in a full tick's after-render
    // phase, which defers the refocus past the change detection that remounts the button.
    let wasExpanded = false;
    effect(() => {
      const expanded = this.handle()?.expanded() ?? false;

      if (wasExpanded && !expanded) {
        afterNextRender(() => this.requestToggleButton()?.nativeElement.focus(), {
          injector: this.injector,
        });
      }

      wasExpanded = expanded;
    });
  }
}
