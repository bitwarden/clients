/* eslint-disable no-restricted-imports -- Prototype feature using licensed services */
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  RiskInsightsItem,
  RiskInsightsItemStatus,
} from "@bitwarden/common/dirt/reports/risk-insights";
import { BadgeModule } from "@bitwarden/components";
/* eslint-enable no-restricted-imports */

/**
 * Shared component for displaying cipher health badges (Weak/Reused/Exposed indicators).
 *
 * Used in the Applications and Members tabs' expanded row views to display
 * consistent health status badges for individual ciphers.
 *
 * Displays:
 * - W badge (warning) for weak passwords
 * - R badge (warning) for reused passwords
 * - E badge (danger) for exposed passwords
 * - Check icon for healthy items
 * - Spinner for items still loading
 */
@Component({
  selector: "app-cipher-health-badges",
  standalone: true,
  imports: [CommonModule, JslibModule, BadgeModule],
  template: `
    <div class="tw-flex tw-justify-center tw-gap-2">
      @if (cipher().weakPassword === true) {
        <span bitBadge variant="warning" title="{{ 'weak' | i18n }}">W</span>
      }
      @if (cipher().reusedPassword === true) {
        <span bitBadge variant="warning" title="{{ 'reused' | i18n }}">R</span>
      }
      @if (cipher().exposedPassword === true) {
        <span
          bitBadge
          variant="danger"
          [title]="cipher().exposedCount + ' ' + ('timesExposed' | i18n)"
          >E</span
        >
      }
      @if (isHealthy()) {
        <i class="bwi bwi-check tw-text-success-600" aria-hidden="true"></i>
      }
      @if (cipher().status === null) {
        <i
          class="bwi bwi-spinner bwi-spin tw-text-muted"
          aria-hidden="true"
          title="{{ 'loading' | i18n }}"
        ></i>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CipherHealthBadgesComponent {
  /** The cipher item to display health badges for */
  readonly cipher = input.required<RiskInsightsItem>();

  /** Computed signal to determine if the cipher is healthy with no issues */
  protected readonly isHealthy = computed(() => {
    const c = this.cipher();
    return (
      c.status === RiskInsightsItemStatus.Healthy &&
      !c.weakPassword &&
      !c.reusedPassword &&
      !c.exposedPassword
    );
  });
}
