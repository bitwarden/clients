import {
  ComponentRef,
  DestroyRef,
  Directive,
  OnInit,
  Renderer2,
  ViewContainerRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NgControl } from "@angular/forms";

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
  exportAs: "bitManaged",
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

  readonly managed = signal(false);

  private badgeRef?: ComponentRef<BadgeComponent>;

  ngOnInit() {
    // Reactive (formControlName) controls exist now, so disable them synchronously.
    this.apply();
    // NgModel creates its FormControl during its own ngOnInit, which may run after ours;
    // re-apply on a microtask so a template-driven control exists before we disable it.
    void Promise.resolve().then(() => this.apply());
    // React to a late-arriving or removed profile (PM-26324).
    this.managedSettings.changes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.apply());
  }

  private apply() {
    const managed = this.managedSettings.isManaged(this.key());
    this.managed.set(managed);
    this.render(managed);
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
    // The label is captured once as a text node, not bound. Acceptable because the
    // consumer's translated string is constant for the session (a language change
    // reloads the app); a control that toggles managed re-creates the badge anyway.
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
