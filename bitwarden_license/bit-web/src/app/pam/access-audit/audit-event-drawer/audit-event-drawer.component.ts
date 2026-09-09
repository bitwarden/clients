import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import {
  BadgeModule,
  CopyClickDirective,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  IconButtonModule,
  LinkModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";
import { ResolvedMember } from "@bitwarden/web-vault/app/dirt/event-logs/components/send-access-member";

import { AuditRow, auditRuleDeleted } from "../access-audit-row";

/**
 * One audit event, plus what the table already worked out about it.
 *
 * The two identities arrive already resolved, not as ids to look up: whether a name is an anchor
 * depends on the page's one member lookup, which this drawer must not contradict.
 */
export type AuditEventDrawerParams = {
  row: AuditRow;
  organizationId: string;
  /** The actor as someone whose history can be opened, or null when the row shows no anchor. */
  actor: ResolvedMember | null;
  /** The requester, on the same terms as {@link AuditEventDrawerParams.actor}. */
  requester: ResolvedMember | null;
  /**
   * Whether the viewer may open the rule editor this pane's access-rule name links to. This page's own
   * `canAccessEventLogs` does not imply it, so for many auditors the name stays plain text.
   */
  canManageAccessRules: boolean;
  /**
   * Whether the viewer may open the organization vault the collection name links to, which is guarded
   * by `canViewAllCollections` — again not implied by the permission that opened this trail.
   */
  canViewCollections: boolean;
};

/**
 * One audit event read whole, in the side drawer.
 *
 * The table can't hold every field an auditor needs, so everything the row carries is here,
 * including the request and lease ids the table never showed. Every anchor is gated on the
 * permission its target needs — the actor/requester/item open the entity-events dialog under this
 * page's own AccessEventLogs, the rule under `canManageAccessRules`, the collection under
 * `canViewAllCollections` — and the request/lease ids anchor nothing, since no page keys on
 * either, so they render short and copyable instead.
 *
 * Every field renders regardless of value, absence shown as the muted em dash, so a reader can
 * tell "no value" from "not drawn".
 */
@Component({
  selector: "pam-audit-event-drawer",
  templateUrl: "./audit-event-drawer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    BadgeModule,
    CopyClickDirective,
    DialogModule,
    IconButtonModule,
    LinkModule,
    I18nPipe,
  ],
})
export class AuditEventDrawerComponent {
  private readonly dialogService = inject(DialogService);
  /**
   * Optional: the pane normally sits in a drawer it must close before navigating away, but it also
   * renders standalone (a story), where there is no drawer to close.
   */
  private readonly dialogRef = inject(DialogRef, { optional: true });
  protected readonly params = inject<AuditEventDrawerParams>(DIALOG_DATA);

  protected get row(): AuditRow {
    return this.params.row;
  }

  /**
   * The rule editor's route for this event's access rule, or null when the pane must not link it.
   *
   * Null on a deletion even though the name is still there: the rule itself is gone, so the route
   * would 404. Null too without `canManageAccessRules`, which this page's own permission is not.
   */
  protected get ruleRoute(): string[] | null {
    const { ruleName, ruleId } = this.row;
    if (
      ruleName == null ||
      ruleId == null ||
      !this.params.canManageAccessRules ||
      auditRuleDeleted(this.row)
    ) {
      return null;
    }
    return ["/organizations", this.params.organizationId, "pam", "access-rules", ruleId];
  }

  /**
   * The organization vault's route for this event's collection, or null when the pane must not link it.
   *
   * The collection id rides in a query parameter, not the path, landing on that one collection's
   * contents. Null when the name didn't resolve — the collection isn't in this viewer's vault state.
   */
  protected get collectionRoute(): string[] | null {
    const { collectionName, collectionId } = this.row;
    if (collectionName == null || collectionId == null || !this.params.canViewCollections) {
      return null;
    }
    return ["/organizations", this.params.organizationId, "vault"];
  }

  /** An id in the short form the organization event log uses, which is enough to match two records by eye. */
  protected shortId(id: string): string {
    return id.substring(0, 8);
  }

  /** Closes the drawer when following a link out, so no pane is stranded over the page beneath. */
  protected closeDrawer(): void {
    void this.dialogRef?.close();
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
