import { computed, inject, Injectable, Signal, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * Coordinates `bit-header` with a `bit-breadcrumbs` projected into it.
 *
 * Angular's element injector follows the tree where a node is *declared*, not where it is rendered.
 * When breadcrumbs are projected through a wrapper (web/desktop's `app-header`), that wrapper is
 * their injector parent and `bit-header` sits in a sibling branch — so the breadcrumbs cannot
 * inject `bit-header` directly. Providing this context on the wrapper gives both components a
 * shared instance to coordinate through.
 */
@Injectable()
export class HeaderContext {
  private readonly configService = inject(ConfigService, { optional: true });

  /**
   * Whether a projected `bit-breadcrumbs` should promote its active crumb to the page `<h1>`.
   *
   * Remove when the VFO1 flag is removed — promotion then follows solely from the presence of a
   * `HeaderContext`.
   */
  readonly promoteActiveBreadcrumb = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  private readonly promotedHeading = signal<Signal<boolean> | undefined>(undefined);

  /**
   * Whether a projected `bit-breadcrumbs` has taken over rendering the page's `<h1>`, in which case
   * `bit-header` must not render its own.
   */
  readonly hasPromotedHeading = computed(() => this.promotedHeading()?.() ?? false);

  /**
   * Called by a projected `bit-breadcrumbs` to report whether it renders the page's `<h1>`.
   *
   * Handing over the signal itself — rather than writing a boolean on every change — keeps this a
   * one-time registration, so neither component needs an `effect` to stay in sync.
   */
  registerPromotedHeading(promoted: Signal<boolean>) {
    this.promotedHeading.set(promoted);
  }

  /**
   * Unregister the promoted heading source. Called by a projected `bit-breadcrumbs` on destroy.
   * Only unregister if the current promoted heading matches, to prevent erroneous unregistrations
   * in edge cases like race conditions
   */
  unregisterPromotedHeading(promoted: Signal<boolean>) {
    if (this.promotedHeading() === promoted) {
      this.promotedHeading.set(undefined);
    }
  }
}
