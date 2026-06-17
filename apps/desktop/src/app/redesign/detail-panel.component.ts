import { ChangeDetectionStrategy, Component, computed, input, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ItemDetail } from "@klappstuhl/ui-bridge";
import {
  KlsButtonComponent,
  KlsCopyFieldComponent,
  KlsRevealFieldComponent,
  KlsStrengthMeterComponent,
  KlsTotpRingComponent,
} from "@klappstuhl/ui-kit";
import { interval } from "rxjs";

import { mockStrength } from "./mock-data";

/**
 * Right pane: item detail using the ui-kit primitives. Preview-only copy writes
 * to the clipboard directly (mock data); in production this routes through the
 * bridge CopyService. TOTP code/countdown are mocked here — real codes come from
 * core's TotpService via the bridge.
 */
@Component({
  selector: "kls-detail-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    KlsButtonComponent,
    KlsCopyFieldComponent,
    KlsRevealFieldComponent,
    KlsStrengthMeterComponent,
    KlsTotpRingComponent,
  ],
  host: { class: "tw-flex tw-h-full tw-flex-1 tw-flex-col tw-bg-bg-primary" },
  template: `
    @let it = item();
    @if (it) {
      <div
        class="tw-flex tw-items-center tw-gap-4 tw-p-6"
        style="border-bottom: var(--fk-glass-border)"
      >
        <span
          class="tw-flex tw-size-12 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-[var(--fk-radius-xl)] tw-text-lg tw-font-semibold tw-text-fg-brand"
          style="background-color: var(--fk-card-bg); backdrop-filter: blur(var(--fk-blur-subtle)); -webkit-backdrop-filter: blur(var(--fk-blur-subtle)); box-shadow: var(--fk-elev-glow)"
        >
          {{ it.title.charAt(0).toUpperCase() }}
        </span>
        <div class="tw-min-w-0 tw-flex-1">
          <h1 class="tw-truncate tw-text-[22px] tw-font-semibold tw-text-fg-heading">
            {{ it.title }}
          </h1>
          <p class="tw-text-sm tw-capitalize tw-text-fg-body-subtle">{{ it.kind }}</p>
        </div>
        <button type="button" klsButton variant="secondary" size="sm">Edit</button>
      </div>

      <div class="tw-flex-1 tw-overflow-y-auto tw-p-6">
        <div
          class="tw-divide-y tw-divide-border-base tw-rounded-[var(--fk-radius-xl)] tw-px-5"
          style="background-color: var(--fk-card-bg); backdrop-filter: blur(var(--fk-blur-subtle)); -webkit-backdrop-filter: blur(var(--fk-blur-subtle)); border: var(--fk-glass-border-strong); box-shadow: var(--fk-glass-highlight), var(--fk-elev-sm)"
        >
          @if (it.username) {
            <kls-copy-field label="Username" [value]="it.username" (copy)="onCopy($event)" />
          }
          @if (it.password) {
            <kls-reveal-field label="Password" [value]="it.password" (copy)="onCopy($event)" />
            <div class="tw-py-3">
              <kls-strength-meter [score]="strength()" />
            </div>
          }
          @if (it.totpAvailable) {
            <div class="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-py-2">
              <kls-copy-field
                class="tw-flex-1"
                label="One-time code"
                [value]="totpCode()"
                [mono]="true"
                (copy)="onCopy($event)"
              />
              <kls-totp-ring [remaining]="totpRemaining()" [period]="30" [size]="40" />
            </div>
          }
          @for (uri of it.uris ?? []; track uri) {
            <kls-copy-field label="Website" [value]="uri" (copy)="onCopy($event)" />
          }
          @if (it.notes) {
            <div class="tw-py-3">
              <div class="tw-mb-1 tw-text-[12px] tw-font-medium tw-text-fg-body-subtle">Notes</div>
              <p class="tw-whitespace-pre-line tw-text-sm tw-text-fg-body">{{ it.notes }}</p>
            </div>
          }
          @if (!it.username && !it.password && !it.notes && (it.uris ?? []).length === 0) {
            <p class="tw-py-6 tw-text-sm tw-text-fg-body-subtle">
              {{ it.subtitle || "No additional details." }}
            </p>
          }
        </div>
      </div>
    } @else {
      <div
        class="tw-flex tw-flex-1 tw-items-center tw-justify-center tw-text-sm tw-text-fg-body-subtle"
      >
        Select an item to view its details.
      </div>
    }
  `,
})
export class KlsDetailPanelComponent {
  readonly item = input<ItemDetail | undefined>(undefined);

  private readonly now = signal(Date.now());

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
  }

  protected readonly strength = computed(() => mockStrength(this.item()?.password));

  protected readonly totpRemaining = computed(() => 30 - (Math.floor(this.now() / 1000) % 30));

  protected readonly totpCode = computed(() => {
    const window = Math.floor(this.now() / 30000);
    return Math.abs((window * 9301 + 49297) % 1000000)
      .toString()
      .padStart(6, "0");
  });

  protected onCopy(value: string): void {
    void navigator.clipboard?.writeText(value);
  }
}
