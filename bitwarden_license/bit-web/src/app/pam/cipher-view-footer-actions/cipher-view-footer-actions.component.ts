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
 * PM-43662 moved the request affordance out of the in-body card
 * ({@link CipherViewBannerComponent}) and into the footer, to follow the standard footer pattern
 * for primary and secondary actions. The card still owns the form; this component owns only the
 * buttons that drive it, reading the shared {@link RequestAccessFooterActions} handle the card
 * publishes through {@link RequestAccessFooterBridge}.
 *
 * Renders nothing when there is no published handle, when the published handle belongs to a
 * DIFFERENT cipher (a handle left over from a previously open item), or when the matching
 * handle's own `visible` is false — an ordinary cipher's dialog footer must look exactly as it
 * does today.
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
    // Collapsing — whether from this footer's own Cancel or from a submit that closed the form on
    // the card's side — unmounts [Submit request]/[Cancel] and remounts [Request access]. Refocus
    // it so a keyboard caller is not dropped back at the top of the dialog. Keyed off the
    // collapse EDGE, not off `expanded` being false: the resting state is also false, and
    // focusing the toggle every time the footer renders would steal focus on open.
    // Deliberately `effect` + `afterNextRender` rather than a single `afterRenderEffect`: the
    // latter only runs in the after-render phase of a full application tick, which defers the
    // refocus past the change detection that remounts the button. An `effect` flushes with
    // change detection and then waits exactly one render for its target to exist.
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
