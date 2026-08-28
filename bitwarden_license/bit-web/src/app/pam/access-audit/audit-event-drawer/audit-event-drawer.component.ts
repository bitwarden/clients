import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import {
  BadgeModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  LinkModule,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";
import { ResolvedMember } from "@bitwarden/web-vault/app/dirt/event-logs/components/send-access-member";

import { AuditRow } from "../access-audit-row";

/**
 * One audit event, plus what the table already worked out about it.
 *
 * The two identities arrive already resolved rather than as ids to look up: whether a name is an
 * anchor depends on the member lookup the page ran once for the whole trail, which this drawer has
 * no business repeating — and must not disagree with, or a name that is plain text in the row would
 * become a link in the pane over it.
 */
export type AuditEventDrawerParams = {
  row: AuditRow;
  organizationId: string;
  /** The actor as someone whose event history can be opened, or null when the row shows no anchor. */
  actor: ResolvedMember | null;
  /** The requester, on the same terms as {@link AuditEventDrawerParams.actor}. */
  requester: ResolvedMember | null;
};

/**
 * One audit event read whole, in the side drawer.
 *
 * The table cannot hold every field an auditor needs — Detail alone is unbounded free text, and the
 * column it used to occupy cost the other six more width than it earned. Everything the row carries
 * is here instead, including the request, lease and rule ids, which the table never showed at all
 * and which are what support asks for when an event has to be chased beyond this page.
 *
 * Read-only, and deliberately without a drill-down to another PAM page, for the reason the table has
 * none: the request-detail page is authorized for the requester or a managing approver, a different
 * permission from the AccessEventLogs one that opens this trail. What the names and the item do open
 * is the shared entity-events dialog, exactly as the equivalent cells do, over that same permission.
 *
 * Every field renders, whether or not the event carries a value for it, absence showing as the muted
 * em dash the table uses. A pane that dropped its empty rows would read as a different event each
 * time, and an auditor could not tell "we hold no value for this" from "this pane forgot to draw it".
 */
@Component({
  selector: "pam-audit-event-drawer",
  templateUrl: "./audit-event-drawer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BadgeModule, DialogModule, LinkModule, TooltipDirective, I18nPipe],
})
export class AuditEventDrawerComponent {
  private readonly dialogService = inject(DialogService);
  protected readonly params = inject<AuditEventDrawerParams>(DIALOG_DATA);

  protected get row(): AuditRow {
    return this.params.row;
  }

  /** Opens an identity's own event history, the way the table's equivalent cell opens it. */
  protected openMemberEvents(event: Event, member: ResolvedMember): void {
    event.preventDefault();
    if (member.organizationUserId == null) {
      return;
    }
    openEntityEventsDialog(this.dialogService, {
      data: {
        entity: "user",
        entityId: member.organizationUserId,
        organizationId: this.params.organizationId,
        name: member.name,
        showUser: true,
      },
    });
  }

  /** Opens the subject item's own event history. Reachable only from an item this viewer's vault decrypted. */
  protected openCipherEvents(event: Event): void {
    event.preventDefault();
    const { cipherId, cipherName } = this.row;
    if (cipherId == null || cipherName == null) {
      return;
    }
    openEntityEventsDialog(this.dialogService, {
      data: {
        entity: "cipher",
        entityId: cipherId,
        organizationId: this.params.organizationId,
        name: cipherName,
        showUser: true,
      },
    });
  }

  static open(dialogService: DialogService, config: DialogConfig<AuditEventDrawerParams>) {
    return dialogService.openDrawer<unknown, AuditEventDrawerParams, AuditEventDrawerComponent>(
      AuditEventDrawerComponent,
      config,
    );
  }
}
