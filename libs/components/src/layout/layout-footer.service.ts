import { Portal } from "@angular/cdk/portal";
import { Injectable, signal } from "@angular/core";

/**
 * Hosts content pinned to the bottom of the layout's main content area — e.g. a
 * bulk-actions bar.
 *
 * The layout renders this portal in a region that overlaps `<main>` but sits outside its
 * scroll container, so the content stays pinned to the viewport while `<main>` scrolls and is
 * horizontally aligned to the main content column. Consumers attach a `TemplatePortal` /
 * `ComponentPortal` and detach it on destroy.
 */
@Injectable({ providedIn: "root" })
export class LayoutFooterService {
  /** The portal to display in the layout footer region. */
  readonly portal = signal<Portal<unknown> | undefined>(undefined);

  attach(portal: Portal<unknown>) {
    this.portal.set(portal);
  }

  detach(portal: Portal<unknown>) {
    if (portal === this.portal()) {
      this.portal.set(undefined);
    }
  }
}
