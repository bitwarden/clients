/* eslint-disable no-restricted-imports -- Prototype feature using licensed services */
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RiskInsightsPrototypeOrchestrationService } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import {
  ProcessingPhase,
  RiskInsightsItem,
  RiskInsightsItemStatus,
  RiskInsightsMember,
} from "@bitwarden/common/dirt/reports/risk-insights";
import { BadgeModule, TableDataSource, TableModule } from "@bitwarden/components";
/* eslint-enable no-restricted-imports */

import { CipherHealthBadgesComponent } from "../shared/cipher-health-badges.component";

/**
 * Members tab component for the Risk Insights Prototype.
 *
 * Displays a table of organization members with aggregated cipher data.
 * Features:
 * - Expandable rows to show ciphers each member has access to
 * - Virtual scrolling table for large datasets
 * - At-risk cipher counts per member
 */
@Component({
  selector: "app-risk-insights-prototype-members",
  templateUrl: "./risk-insights-prototype-members.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, TableModule, BadgeModule, CipherHealthBadgesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsPrototypeMembersComponent {
  // ============================================================================
  // Injected Dependencies
  // ============================================================================
  private readonly orchestrator = inject(RiskInsightsPrototypeOrchestrationService);

  // ============================================================================
  // Expose Orchestrator Signals to Template
  // ============================================================================

  // Processing state
  readonly processingPhase = this.orchestrator.processingPhase;
  readonly memberProgress = this.orchestrator.memberProgress;
  readonly error = this.orchestrator.error;

  // Results
  readonly members = this.orchestrator.members;
  readonly items = this.orchestrator.items;

  // Expose constants for template access
  readonly ProcessingPhase = ProcessingPhase;
  readonly RiskInsightsItemStatus = RiskInsightsItemStatus;

  // ============================================================================
  // Component State
  // ============================================================================

  /** Table data source for virtual scrolling */
  protected readonly dataSource = new TableDataSource<RiskInsightsMember>();

  /** Row size for virtual scrolling (in pixels) */
  protected readonly ROW_SIZE = 52;

  /** Set of expanded member IDs */
  protected readonly expandedMembers = signal(new Set<string>());

  /** Cached item map for O(1) cipher lookups - rebuilt only when items() changes */
  private readonly itemMap = computed(() => {
    const items = this.items();
    return new Map(items.map((item) => [item.cipherId, item]));
  });

  // ============================================================================
  // Lifecycle
  // ============================================================================

  constructor() {
    // Effect to sync members signal to table data source
    effect(() => {
      const members = this.members();
      this.dataSource.data = members;
    });

    // Effect to trigger lazy loading of member aggregations when phase is ready
    // Check actual state (members array length) instead of a local flag to handle
    // component re-creation and state resets correctly
    effect(() => {
      const phase = this.processingPhase();
      const isReady = phase === ProcessingPhase.Complete || phase === ProcessingPhase.RunningHibp;
      const membersEmpty = this.members().length === 0;

      if (isReady && membersEmpty) {
        this.orchestrator.ensureMemberAggregationsBuilt();
      }
    });
  }

  // ============================================================================
  // Expansion Methods
  // ============================================================================

  /** Toggle expansion state for a member */
  protected toggleExpanded(memberId: string): void {
    this.expandedMembers.update((current) => {
      const newSet = new Set(current);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  }

  /** Check if a member is expanded */
  protected isExpanded(memberId: string): boolean {
    return this.expandedMembers().has(memberId);
  }

  /** Get cipher items for a member (for expanded view) - uses cached itemMap for performance */
  protected getCiphersForMember(cipherIds: string[]): RiskInsightsItem[] {
    const map = this.itemMap();
    return cipherIds
      .map((id) => map.get(id))
      .filter((item): item is RiskInsightsItem => item !== undefined);
  }

  /** Check if member data is still loading */
  protected isMemberDataLoading(): boolean {
    const phase = this.processingPhase();
    return (
      phase === ProcessingPhase.LoadingCiphers ||
      phase === ProcessingPhase.RunningHealthChecks ||
      phase === ProcessingPhase.LoadingMembers
    );
  }

  // ============================================================================
  // TrackBy Functions
  // ============================================================================

  /** TrackBy function for members */
  protected trackByMemberId(_index: number, member: RiskInsightsMember): string {
    return member.memberId;
  }

  /** TrackBy function for cipher items */
  protected trackByCipherId(_index: number, item: RiskInsightsItem): string {
    return item.cipherId;
  }
}
