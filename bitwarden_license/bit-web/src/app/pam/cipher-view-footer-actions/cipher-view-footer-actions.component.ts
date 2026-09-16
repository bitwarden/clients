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
   * The published handle, but only when it matches the cipher this footer was handed — a stale
   * handle from a previously open item must render nothing rather than drive the wrong request.
   */
  protected readonly handle = computed(() => {
    const actions = this.bridge.actions();
    const cipherId = this.cipher().id;
    return actions != null && cipherId != null && actions.cipherId === cipherId ? actions : null;
  });

  /** Refocused once the form collapses — see the constructor effect below. */
  private readonly requestToggleButton = viewChild("requestToggleButton", {
    read: ElementRef<HTMLElement>,
  });

  constructor() {
    // Collapsing — whether from this footer's own Cancel or from a submit that closed the form on
    // the card's side — unmounts [Submit request]/[Cancel] and remounts [Request access]; refocus
    // it the same way `cipher-view-banner.component.ts` refocuses its own toggle, bound to the
    // render that follows the collapse rather than the click itself, since a submit's collapse
    // happens on the card, not here.
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
