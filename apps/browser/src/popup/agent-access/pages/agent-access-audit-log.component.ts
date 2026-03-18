import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { AuditLogEntry } from "../agent-access.types";

interface DayGroup {
  label: string;
  entries: AuditLogEntry[];
}

@Component({
  selector: "app-agent-access-audit-log",
  standalone: true,
  imports: [DatePipe, JslibModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-px-4 tw-pt-4">
      <p class="tw-text-main tw-font-bold tw-text-lg tw-mb-0">Audit log</p>
      <p class="tw-text-muted tw-text-sm tw-mb-4">{{ connectionName() }}</p>

      @if (groups().length === 0) {
        <div class="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-16">
          <p class="tw-text-muted tw-text-sm tw-mb-0">No activity yet</p>
        </div>
      } @else {
        @for (group of groups(); track group.label) {
          <p
            class="tw-text-muted tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-mb-2 tw-mt-4"
          >
            {{ group.label }}
          </p>
          <div class="tw-space-y-2">
            @for (entry of group.entries; track entry.timestamp) {
              <div class="tw-flex tw-items-start tw-gap-3 tw-py-1">
                <!-- Icon -->
                <div
                  class="tw-flex tw-items-center tw-justify-center tw-size-7 tw-rounded-full tw-shrink-0 tw-mt-0.5"
                  [class]="iconBgClass(entry.action)"
                >
                  <i class="bwi tw-text-xs" [class]="iconClass(entry.action)"></i>
                </div>

                <!-- Text -->
                <div class="tw-flex-1 tw-min-w-0">
                  <p class="tw-text-main tw-text-sm tw-mb-0" [innerHTML]="actionText(entry)"></p>
                  @if (entry.action === "credential_approved" && entry.fields?.length) {
                    <p class="tw-text-muted tw-text-xs tw-mb-0">{{ entry.fields!.join(", ") }}</p>
                  }
                </div>

                <!-- Time -->
                <span class="tw-text-muted tw-text-xs tw-shrink-0 tw-mt-0.5">
                  {{ entry.timestamp | date: "shortTime" }}
                </span>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class AgentAccessAuditLogComponent {
  readonly entries = input<AuditLogEntry[]>([]);
  readonly connectionName = input("");

  protected readonly groups = computed(() => this.groupByDay(this.entries()));

  protected iconBgClass(action: AuditLogEntry["action"]): string {
    switch (action) {
      case "credential_approved":
        return "tw-bg-success-600/10";
      case "credential_denied":
        return "tw-bg-danger-600/10";
      case "connected":
        return "tw-bg-primary-600/10";
      case "disconnected":
        return "tw-bg-secondary-300/30";
    }
  }

  protected iconClass(action: AuditLogEntry["action"]): string {
    switch (action) {
      case "credential_approved":
        return "bwi-check tw-text-success";
      case "credential_denied":
        return "bwi-close tw-text-danger";
      case "connected":
        return "bwi-lock tw-text-primary-600";
      case "disconnected":
        return "bwi-unlock tw-text-muted";
    }
  }

  protected actionText(entry: AuditLogEntry): string {
    switch (entry.action) {
      case "credential_approved":
        return `Credentials approved for <strong>${this.escapeHtml(entry.domain ?? "unknown")}</strong>`;
      case "credential_denied":
        return `Request denied for <strong>${this.escapeHtml(entry.domain ?? "unknown")}</strong>`;
      case "connected":
        return "Connection established";
      case "disconnected":
        return "Device disconnected";
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private groupByDay(entries: AuditLogEntry[]): DayGroup[] {
    if (entries.length === 0) {
      return [];
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 6 * 86400000;

    const groups: Map<string, AuditLogEntry[]> = new Map();
    const order = ["Today", "Yesterday", "This week", "Older"];

    // Process newest first
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

    for (const entry of sorted) {
      let label: string;
      if (entry.timestamp >= todayStart) {
        label = "Today";
      } else if (entry.timestamp >= yesterdayStart) {
        label = "Yesterday";
      } else if (entry.timestamp >= weekStart) {
        label = "This week";
      } else {
        label = "Older";
      }

      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(entry);
    }

    return order
      .filter((label) => groups.has(label))
      .map((label) => ({ label, entries: groups.get(label)! }));
  }
}
