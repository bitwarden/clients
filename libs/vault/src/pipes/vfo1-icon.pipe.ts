import { inject, Pipe, PipeTransform } from "@angular/core";

import { Vfo1TerminologyService } from "../services/vfo1-terminology.service";

/**
 * Pipe for swapping an icon class to its VFO1 equivalent when the vault terminology feature flag
 * is on. Icon classes without a mapping are returned unchanged.
 * This pipe is impure because it depends on the feature flag state, which can change at runtime.
 * It caches the last result to avoid recomputing when the inputs haven't changed.
 */
@Pipe({ name: "vfo1Icon", standalone: true, pure: false })
export class Vfo1IconPipe implements PipeTransform {
  private terminology = inject(Vfo1TerminologyService);

  private last?: { in: string; enabled: boolean; out: string };

  transform(iconClass: string): string {
    const enabled = this.terminology.enabled();
    if (this.last && this.last.in === iconClass && this.last.enabled === enabled) {
      return this.last.out;
    }

    const out = this.terminology.iconClass(iconClass);

    // Cache the result for future calls with the same inputs
    this.last = { in: iconClass, enabled, out };

    return out;
  }
}
