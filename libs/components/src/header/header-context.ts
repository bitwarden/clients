import { Injectable, signal } from "@angular/core";

@Injectable()
export class HeaderContext {
  /**
   * Set by bit-header: promote the projected breadcrumbs' active crumb to the page <h1>.
   * Remove when VFO1 flag is removed.
   */
  readonly shouldPromoteActiveBreadcrumb = signal(false);

  /** Reported by a projected bit-breadcrumbs: whether it has an active crumb to promote. */
  readonly hasActiveBreadcrumb = signal(false);
}
