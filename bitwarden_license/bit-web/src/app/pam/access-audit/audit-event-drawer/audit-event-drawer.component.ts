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
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";
import { ResolvedMember } from "@bitwarden/web-vault/app/dirt/event-logs/components/send-access-member";

import { AuditRow, auditRuleDeleted } from "../access-audit-row";

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
 * The table cannot hold every field an auditor needs — Detail alone is unbounded free text, and the
 * column it used to occupy cost the other six more width than it earned. Everything the row carries
 * is here instead, including the request and lease ids, which the table never showed at all and which
 * are what support asks for when an event has to be chased beyond this page.
 *
 * Read-only, and every anchor is gated on the viewer holding the permission its target is guarded by.
 * This page is authorized by AccessEventLogs alone, which implies very little else, so an ungated link
 * would send an auditor into a bounce from the pane that is meant to explain the event. The actor, the
 * requester and the item open the shared entity-events dialog over that same AccessEventLogs
 * permission; the access rule opens the rule editor only under `canManageAccessRules`, and the
 * collection opens the organization vault narrowed to it only under `canViewAllCollections`.
 *
 * The request and lease ids anchor nothing at all: the request-detail page is authorized for the
 * request's requester or a managing approver, which is a different permission again, and no page keys
 * on a lease id. They are rendered short and made copyable instead, so an auditor can hand support the
 * whole id without reading thirty-six characters off the screen.
 *
 * Every field renders, whether or not the event carries a value for it, absence showing as the muted
 * em dash the table uses. A pane that dropped its empty rows would read as a different event each
 * time, and an auditor could not tell "we hold no value for this" from "this pane forgot to draw it".
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
    TooltipDirective,
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
   * Null on a deletion even though the name is still there to render: the store snapshotted it at write
   * time and the rule itself is gone, so the route would 404 on the one rule event an auditor most needs
   * to read. Null too without `canManageAccessRules`, which is the guard on that route and is not what
   * authorized this page.
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
   * The collection id rides in a query parameter rather than the path — the same anchor the admin
   * console's own collection rows use — so the landing is that one collection's contents, never an
   * unfiltered list. A name that did not resolve means the collection is not in this viewer's local
   * vault state, which is reason enough not to send them to it.
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

  /** Closes the drawer when following a link out of it, so no pane is stranded over the page beneath. */
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
