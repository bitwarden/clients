import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { PopoverComponent, PopoverModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  NewItemTypesAnnouncementService,
  NewItemTypesCoachmarkCopy,
} from "../../services/new-item-types-announcement.service";

/**
 * Single-message coachmark announcing the new item types. Bind the anchor element to it:
 *
 * @example
 * ```html
 * <button
 *   [bitPopoverAnchorFor]="newTypes.popover()"
 *   [popoverOpen]="newTypes.open()"
 *   (popoverOpenChange)="newTypes.openChange($event)"
 * ></button>
 * <vault-new-item-types-coachmark #newTypes />
 * ```
 */
@Component({
  selector: "vault-new-item-types-coachmark",
  imports: [I18nPipe, PopoverModule, TypographyModule],
  templateUrl: "new-item-types-coachmark.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: "newItemTypesCoachmark",
  // The popover renders in a CDK overlay, so the host stays out of the anchor's layout
  host: { class: "tw-hidden" },
})
export class NewItemTypesCoachmarkComponent {
  private readonly announcementService = inject(NewItemTypesAnnouncementService);

  /** Set to `false` while the anchor can't be used, or on all but one anchor on a page */
  readonly enabled = input(true);

  readonly popover = viewChild.required(PopoverComponent);

  private readonly pendingCopy = toSignal(this.announcementService.coachmarkCopy$, {
    initialValue: null,
  });

  /** Copy held from first display, since showing it marks the coachmark seen */
  protected readonly copy = signal<NewItemTypesCoachmarkCopy | null>(null);
  private readonly closed = signal(false);

  readonly open = computed(() => this.copy() != null && !this.closed());

  constructor() {
    effect(() => {
      const pending = this.pendingCopy();
      if (!this.enabled() || pending == null || untracked(this.copy) != null) {
        return;
      }
      this.copy.set(pending);
      void this.announcementService.dismissCoachmark(pending.userId);
    });
  }

  /** Pass the anchor's `popoverOpenChange` so any close (X, Escape, outside click) sticks */
  openChange(open: boolean): void {
    if (!open && this.copy() != null) {
      this.closed.set(true);
    }
  }
}
