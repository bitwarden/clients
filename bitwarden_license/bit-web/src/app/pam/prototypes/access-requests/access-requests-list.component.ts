import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { IconComponent as VaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import {
  BadgeComponent,
  BadgeVariant,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  FilterMenuComponent,
  FilterOptionComponent,
  IconButtonModule,
  SearchModule,
  TypographyModule,
  defineTable,
} from "@bitwarden/components";

import {
  AccessRequestContext,
  AccessRequestDetailView,
  AccessRequestStatus,
  buildCipherForRequest,
} from "./access-request.model";

/** Verbs the list emits so the page can translate each into a dialog / toast. */
export type RowAction = "approve" | "deny" | "revoke" | "cancel" | "activate" | "endSession";

export interface RowActionEvent {
  request: AccessRequestDetailView;
  action: RowAction;
}

interface StatusBadge {
  variant: BadgeVariant;
  label: string;
  icon?: string;
}

interface HoverAction {
  key: RowAction;
  label: string;
  icon: string;
  buttonType: "success" | "danger" | "secondary";
}

type FilterValues = {
  search?: string;
  status?: AccessRequestStatus[] | null;
  folder?: string[] | null;
  requester?: string[] | null;
};

/**
 * Reusable Access Requests table — same shell for every tab, columns and row
 * actions keyed off the `context` input. Approvals and My requests surface
 * status as a badge and reveal row actions on hover; History renders as a
 * read-only ledger with the resolver and resolved-time columns instead.
 */
@Component({
  selector: "pam-access-requests-list",
  templateUrl: "./access-requests-list.component.html",
  imports: [
    CommonModule,
    BadgeComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ButtonModule,
    FilterMenuComponent,
    FilterOptionComponent,
    IconButtonModule,
    SearchModule,
    TypographyModule,
    VaultIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestsListComponent {
  readonly requests = input.required<AccessRequestDetailView[]>();
  readonly context = input.required<AccessRequestContext>();

  readonly rowClick = output<AccessRequestDetailView>();
  readonly action = output<RowActionEvent>();

  protected readonly table = defineTable<AccessRequestDetailView, "actions">(this.requests);

  protected readonly isHistory = computed(() => this.context() === "history");
  protected readonly isMyRequests = computed(() => this.context() === "my-requests");

  /** Status options for the context — approvals/my-requests show live states, history shows terminal states. */
  protected readonly statusOptions = computed<{ label: string; value: AccessRequestStatus }[]>(
    () => {
      if (this.isHistory()) {
        return [
          { label: "Denied", value: "denied" },
          { label: "Revoked", value: "revoked" },
          { label: "Canceled", value: "canceled" },
          { label: "Expired", value: "expired" },
          { label: "Session ended", value: "sessionEnded" },
        ];
      }
      return [
        { label: "Pending approval", value: "pending" },
        { label: "Ready to use", value: "readyToUse" },
        { label: "In use", value: "active" },
        { label: "Ending soon", value: "endingSoon" },
      ];
    },
  );

  protected readonly folderOptions = computed(() =>
    uniqueSorted(
      this.requests()
        .map((r) => r.folder)
        .filter((f): f is string => !!f),
    ).map((name) => ({ label: name, value: name })),
  );

  protected readonly requesterOptions = computed(() =>
    uniqueSorted(this.requests().map((r) => r.requester.name)).map((name) => ({
      label: name,
      value: name,
    })),
  );

  /** Row-level filter — `active` and `endingSoon` share the "In use" status chip. */
  protected readonly rowMatchesFilter = (
    row: AccessRequestDetailView,
    f: FilterValues,
  ): boolean => {
    if (f.search?.trim()) {
      const needle = f.search.trim().toLowerCase();
      const haystack = [row.itemName, row.folder ?? "", row.requester.name, row.reason ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    if (f.status?.length) {
      const match = f.status.some((s) =>
        s === "active" ? row.status === "active" || row.status === "endingSoon" : row.status === s,
      );
      if (!match) {
        return false;
      }
    }
    if (f.folder?.length && !f.folder.includes(row.folder ?? "")) {
      return false;
    }
    if (f.requester?.length && !f.requester.includes(row.requester.name)) {
      return false;
    }
    return true;
  };

  protected statusBadge(status: AccessRequestStatus, leaseRemaining?: string): StatusBadge {
    switch (status) {
      case "pending":
        return { variant: "warning", label: "Pending approval", icon: "bwi-clock" };
      case "approved":
      case "readyToUse":
        return { variant: "success", label: "Ready to use", icon: "bwi-check" };
      case "active":
        return {
          variant: "accent-primary",
          label: leaseRemaining ? `${leaseRemaining} left` : "Active",
          icon: "bwi-unlock",
        };
      case "endingSoon":
        return {
          variant: "danger",
          label: leaseRemaining ? `Ending soon · ${leaseRemaining} left` : "Ending soon",
          icon: "bwi-exclamation-triangle",
        };
      case "denied":
        return { variant: "danger", label: "Denied", icon: "bwi-lock" };
      case "canceled":
        return { variant: "subtle", label: "Canceled", icon: "bwi-lock" };
      case "expired":
        return { variant: "danger", label: "Expired", icon: "bwi-lock" };
      case "revoked":
        return { variant: "subtle", label: "Revoked", icon: "bwi-lock" };
      case "sessionEnded":
        return { variant: "subtle", label: "Session ended", icon: "bwi-lock" };
    }
  }

  /** Plain-text label for the History status column (badges aren't used there). */
  protected statusLabel(status: AccessRequestStatus): string {
    return this.statusBadge(status).label;
  }

  protected resolvedBy(row: AccessRequestDetailView): string {
    if (!row.resolvedBy) {
      return "—";
    }
    return row.resolvedBy === "automatic" ? "System" : row.resolvedBy.name;
  }

  /**
   * Splits a pre-formatted window string like `"4 hours, Tomorrow 9 AM to 1 PM"`
   * into a bold duration line and a muted "when" subline. The duration is always
   * the first comma-delimited segment; the rest is the "when" sentence (which
   * may itself contain commas, as in `"Sept 30, 4:12 PM to Oct 3, 4:12 PM"` or
   * `"Oct 14, 2025, 9 AM to 1 PM"` when the window is from a prior year — see
   * the `accessRequested` field doc on the model for the year convention).
   */
  protected splitDuration(formatted: string): { duration: string; when: string } {
    const comma = formatted.indexOf(",");
    if (comma === -1) {
      return { duration: formatted, when: "" };
    }
    return {
      duration: formatted.slice(0, comma).trim(),
      when: formatted.slice(comma + 1).trim(),
    };
  }

  /** Hover-reveal row actions, context + status aware. */
  protected hoverActions(row: AccessRequestDetailView): HoverAction[] {
    const ctx = this.context();
    if (ctx === "history") {
      return [];
    }
    if (ctx === "approvals") {
      switch (row.status) {
        case "pending":
          return [
            { key: "approve", label: "Approve request", icon: "bwi-check", buttonType: "success" },
            { key: "deny", label: "Deny request", icon: "bwi-close", buttonType: "danger" },
          ];
        case "readyToUse":
        case "active":
        case "endingSoon":
          return [
            { key: "revoke", label: "Revoke access", icon: "bwi-minus", buttonType: "danger" },
          ];
        default:
          return [];
      }
    }
    switch (row.status) {
      case "pending":
        return [
          { key: "cancel", label: "Cancel request", icon: "bwi-close", buttonType: "secondary" },
        ];
      case "readyToUse":
        return [
          { key: "activate", label: "Start session", icon: "bwi-check", buttonType: "success" },
          { key: "cancel", label: "Cancel request", icon: "bwi-close", buttonType: "secondary" },
        ];
      case "active":
      case "endingSoon":
        return [
          { key: "endSession", label: "End access", icon: "bwi-close", buttonType: "danger" },
        ];
      default:
        return [];
    }
  }

  protected readonly buildCipher = buildCipherForRequest;

  protected onRowClick(row: AccessRequestDetailView): void {
    this.rowClick.emit(row);
  }

  protected onAction(event: Event, request: AccessRequestDetailView, action: RowAction): void {
    // Stop the row click handler from also firing when the hover action is clicked.
    event.stopPropagation();
    this.action.emit({ request, action });
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
