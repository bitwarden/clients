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

/** The identities arrive resolved, so the drawer links names as the table does. */
export type AuditEventDrawerParams = {
  row: AuditRow;
  organizationId: string;
  /** Null when the table shows the actor without a link. */
  actor: ResolvedMember | null;
  requester: ResolvedMember | null;
  /** Gates the rule link; the page's `canAccessEventLogs` does not imply it. */
  canManageAccessRules: boolean;
  /** Gates the collection link, whose route requires `canViewAllCollections`. */
  canViewCollections: boolean;
};

/**
 * Every field the row carries, each link gated on the permission its target needs. Empty fields
 * still render, as a muted dash, so a reader can tell "no value" from "not drawn".
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
  /** Optional, since a story renders the pane without a drawer. */
  private readonly dialogRef = inject(DialogRef, { optional: true });
  protected readonly params = inject<AuditEventDrawerParams>(DIALOG_DATA);

  protected get row(): AuditRow {
    return this.params.row;
  }

  /** Null on a deletion, since the rule is gone even though its name remains. */
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

  /** Null when the name didn't resolve, meaning the collection isn't in this viewer's vault. */
  protected get collectionRoute(): string[] | null {
    const { collectionName, collectionId } = this.row;
    if (collectionName == null || collectionId == null || !this.params.canViewCollections) {
      return null;
    }
    return ["/organizations", this.params.organizationId, "vault"];
  }

  /** The short form the organization event log uses, enough to match two records by eye. */
  protected shortId(id: string): string {
    return id.substring(0, 8);
  }

  /** So no pane is stranded over the page a link opens. */
  protected closeDrawer(): void {
    void this.dialogRef?.close();
  }

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

  /** Reachable only from an item this viewer's vault decrypted. */
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
