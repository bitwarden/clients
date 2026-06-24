import {
  ComponentRef,
  DestroyRef,
  Directive,
  OnInit,
  Renderer2,
  ViewContainerRef,
  inject,
  input,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NgControl } from "@angular/forms";
import { distinctUntilChanged, map, startWith } from "rxjs";

import { ManagedSettingsService } from "@bitwarden/common/platform/managed-settings";

import { BadgeComponent } from "../badge/badge.component";

/**
 * Marks a form control as administrator-managed. When the given managed key is
 * present in the active profile, the host reactive-forms control is disabled and
 * a "managed by your organization" badge is rendered beside it. The state is
 * re-evaluated on every `changes$` emission, so a late-arriving managed profile
 * (PM-26324) flips the control to managed without a reload.
 *
 * The Component Library is i18n-free, so the badge text is supplied by the
 * consuming template rather than read from `I18nService`:
 *
 *   <input bitInput formControlName="baseUrl"
 *          [bitManaged]="'environment.base'"
 *          [bitManagedLabel]="'managedByYourOrganization' | i18n" />
 */
@Directive({
  selector: "[bitManaged]",
  standalone: true,
})
export class BitManagedDirective implements OnInit {
  private readonly managedSettings = inject(ManagedSettingsService);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  /** The managed key whose presence forces this control. */
  readonly key = input.required<string>({ alias: "bitManaged" });
  /** Translated badge text supplied by the consuming template. */
  readonly bitManagedLabel = input("");

  private badgeRef?: ComponentRef<BadgeComponent>;

  ngOnInit() {
    this.managedSettings.changes$
      .pipe(
        startWith(undefined),
        map(() => this.managedSettings.isManaged(this.key())),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((managed) => this.render(managed));
  }

  private render(managed: boolean) {
    const control = this.ngControl?.control;
    if (managed) {
      control?.disable({ emitEvent: false });
      this.showBadge();
    } else {
      control?.enable({ emitEvent: false });
      this.hideBadge();
    }
  }

  private showBadge() {
    if (this.badgeRef != null) {
      return;
    }
    const text = this.renderer.createText(this.bitManagedLabel());
    this.badgeRef = this.viewContainerRef.createComponent(BadgeComponent, {
      projectableNodes: [[text]],
    });
    this.badgeRef.setInput("variant", "subtle");
  }

  private hideBadge() {
    this.badgeRef?.destroy();
    this.badgeRef = undefined;
  }
}
