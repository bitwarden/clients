import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationUserType, RevocationReasonType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Guid, UserId } from "@bitwarden/common/types/guid";
import { BitTableV2Component, TableSelectionModel, ToastService } from "@bitwarden/components";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import { MaxCheckedCount } from "../../../common/people-table-data-source";
import { OrganizationUserView } from "../../core/views/organization-user.view";
import { MemberActionsService } from "../services/member-actions/member-actions.service";
import { BulkActionResult } from "../services/member-actions/member-actions.types";
import { MemberDialogManagerService } from "../services/member-dialog-manager/member-dialog-manager.service";

import { MembersBulkActionsBarComponent } from "./members-bulk-actions-bar.component";

const ADMIN_USER_ID = "admin-user-id";

let nextId = 0;
function member(
  status: OrganizationUserStatusType,
  overrides: { type?: OrganizationUserType; userId?: string; claimed?: boolean } = {},
): OrganizationUserView {
  nextId++;
  return new OrganizationUserView({
    id: `member-${nextId}` as Guid,
    userId: (overrides.userId ?? `user-${nextId}`) as UserId,
    email: `member${nextId}@example.com`,
    type: overrides.type ?? OrganizationUserType.User,
    revocationReason: RevocationReasonType.Unknown,
    status,
    permissions: new PermissionsApi(),
    avatarColor: "#175ddc",
    name: `Member ${nextId}`,
    claimedByOrganization: overrides.claimed ?? false,
  });
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(Object.create(Organization.prototype) as Organization, {
    id: "org-id",
    userId: ADMIN_USER_ID,
    type: OrganizationUserType.Owner,
    isProviderUser: false,
    useSecretsManager: false,
    usePam: false,
    ...overrides,
  });
}

function result(successfulIds: string[], failed: { id: string; error: string }[] = []) {
  const r = new BulkActionResult();
  r.successful = successfulIds.map((id) => ({ id }));
  r.failed = failed;
  return r;
}

describe("MembersBulkActionsBarComponent", () => {
  let fixture: ComponentFixture<MembersBulkActionsBarComponent>;
  let component: MembersBulkActionsBarComponent;
  let rows: ReturnType<typeof signal<OrganizationUserView[]>>;
  let selectionModel: TableSelectionModel<OrganizationUserView>;
  let memberActionsService: MockProxy<MemberActionsService>;
  let memberDialogManager: MockProxy<MemberDialogManagerService>;
  let billingConstraint: MockProxy<BillingConstraintService>;
  let toastService: MockProxy<ToastService>;
  let pamFlag$: BehaviorSubject<boolean>;
  let completed: jest.Mock;

  async function setup(members: OrganizationUserView[], org = organization()) {
    rows = signal(members);
    selectionModel = new TableSelectionModel<OrganizationUserView>({ multiple: true, rows });

    memberActionsService = mock<MemberActionsService>();
    Object.assign(memberActionsService, { isProcessing: signal(false) });
    memberDialogManager = mock<MemberDialogManagerService>();
    memberDialogManager.openBulkActionFailureDialog.mockResolvedValue();
    billingConstraint = mock<BillingConstraintService>();
    billingConstraint.seatLimitReached.mockResolvedValue(false);
    toastService = mock<ToastService>();
    pamFlag$ = new BehaviorSubject(false);
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag) =>
      flag === FeatureFlag.Pam ? (pamFlag$ as any) : of(false),
    );
    const organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
    organizationMetadataService.getOrganizationMetadata$.mockReturnValue(of({} as any));
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string, ...args: unknown[]) =>
      args.length ? `${key}(${args.join(",")})` : key,
    );

    await TestBed.configureTestingModule({
      imports: [MembersBulkActionsBarComponent],
      providers: [
        {
          provide: BitTableV2Component,
          useValue: { selectionModel: signal(selectionModel), sorted: rows },
        },
        { provide: MemberActionsService, useValue: memberActionsService },
        { provide: MemberDialogManagerService, useValue: memberDialogManager },
        { provide: BillingConstraintService, useValue: billingConstraint },
        { provide: OrganizationMetadataServiceAbstraction, useValue: organizationMetadataService },
        { provide: ConfigService, useValue: configService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
      ],
    })
      .overrideComponent(MembersBulkActionsBarComponent, { set: { imports: [], template: "" } })
      .compileComponents();

    fixture = TestBed.createComponent(MembersBulkActionsBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("organization", org);
    completed = jest.fn();
    component.actionCompleted.subscribe(completed);
    fixture.detectChanges();
  }

  const available = () => component["available"]();
  const inline = () => component["inlineActions"]().map((a) => a.action);
  const menu = () => component["menuActions"]().map((a) => a.action);
  const run = async (action: string) => {
    const item = [...component["inlineActions"](), ...component["menuActions"]()].find(
      (a) => a.action === action,
    );
    item!.run();
    await fixture.whenStable();
    // Let the async action chain settle.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  describe("available actions", () => {
    it("offers nothing when no member is selected", async () => {
      await setup([member(OrganizationUserStatusType.Staged)]);

      expect(available()).toEqual([]);
    });

    it("offers Invite when every selected member is Staged", async () => {
      const members = [
        member(OrganizationUserStatusType.Staged),
        member(OrganizationUserStatusType.Staged),
      ];
      await setup(members);
      selectionModel.select(...members);

      expect(available()).toContain("invite");
      expect(available()).not.toContain("resendInvite");
    });

    it("offers Resend invite when every selected member is Invited", async () => {
      const members = [member(OrganizationUserStatusType.Invited)];
      await setup(members);
      selectionModel.select(...members);

      expect(available()).toContain("resendInvite");
      expect(available()).not.toContain("invite");
    });

    it("offers neither Invite nor Resend invite for a mix of Staged and Invited", async () => {
      const members = [
        member(OrganizationUserStatusType.Staged),
        member(OrganizationUserStatusType.Invited),
      ];
      await setup(members);
      selectionModel.select(...members);

      expect(available()).not.toContain("invite");
      expect(available()).not.toContain("resendInvite");
    });

    it("offers Restore access for Revoked members the admin outranks", async () => {
      const members = [member(OrganizationUserStatusType.Revoked)];
      await setup(members, organization({ type: OrganizationUserType.Admin }));
      selectionModel.select(...members);

      expect(available()).toContain("restore");
    });

    it("hides Restore access when an Admin selects a Revoked Owner", async () => {
      const members = [
        member(OrganizationUserStatusType.Revoked),
        member(OrganizationUserStatusType.Revoked, { type: OrganizationUserType.Owner }),
      ];
      await setup(members, organization({ type: OrganizationUserType.Admin }));
      selectionModel.select(...members);

      expect(available()).not.toContain("restore");
    });

    it("hides Restore access when a Custom user selects a Revoked Admin", async () => {
      const members = [
        member(OrganizationUserStatusType.Revoked, { type: OrganizationUserType.Admin }),
      ];
      await setup(members, organization({ type: OrganizationUserType.Custom }));
      selectionModel.select(...members);

      expect(available()).not.toContain("restore");
    });

    it("leaves the admin out of Revoke rather than letting them block it", async () => {
      const self = member(OrganizationUserStatusType.Confirmed, { userId: ADMIN_USER_ID });
      const other = member(OrganizationUserStatusType.Confirmed);
      await setup([self, other]);
      selectionModel.select(self, other);

      expect(available()).toContain("revoke");
    });

    it("doesn't offer Revoke when the admin is the only selected member", async () => {
      const self = member(OrganizationUserStatusType.Confirmed, { userId: ADMIN_USER_ID });
      await setup([self]);
      selectionModel.select(self);

      expect(available()).not.toContain("revoke");
    });

    it("offers Add to Privileged Controls only with the feature flag on", async () => {
      const members = [member(OrganizationUserStatusType.Confirmed)];
      await setup(members, organization({ usePam: true }));
      selectionModel.select(...members);

      expect(available()).not.toContain("addToPrivilegedControls");

      pamFlag$.next(true);

      expect(available()).toContain("addToPrivilegedControls");
    });

    it("lists the actions in the fixed bar order", async () => {
      const members = [member(OrganizationUserStatusType.Confirmed)];
      await setup(members, organization({ useSecretsManager: true }));
      selectionModel.select(...members);

      expect(available()).toEqual(["revoke", "addToSecretsManager", "remove"]);
    });
  });

  describe("placement", () => {
    it("moves Revoke, Remove and Delete into the menu alongside a non-destructive action", async () => {
      const members = [member(OrganizationUserStatusType.Confirmed)];
      await setup(members, organization({ useSecretsManager: true }));
      selectionModel.select(...members);

      expect(inline()).toEqual(["addToSecretsManager"]);
      expect(menu()).toEqual(["revoke", "remove"]);
    });

    it("keeps Revoke, Remove and Delete inline when no non-destructive action applies", async () => {
      const members = [member(OrganizationUserStatusType.Confirmed, { claimed: true })];
      await setup(members);
      selectionModel.select(...members);

      expect(inline()).toEqual(["revoke", "delete"]);
      expect(menu()).toEqual([]);
    });
  });

  describe("Invite", () => {
    it("sends with no confirmation, toasts the singular copy, clears the selection and reloads", async () => {
      const staged = member(OrganizationUserStatusType.Staged);
      await setup([staged]);
      selectionModel.select(staged);
      memberActionsService.bulkSendInvite.mockReturnValue(of(result([staged.id])));

      await run("invite");

      expect(memberActionsService.bulkSendInvite).toHaveBeenCalledWith(expect.anything(), [
        staged.id,
      ]);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "inviteSentToast",
      });
      expect(selectionModel.count()).toBe(0);
      expect(completed).toHaveBeenCalled();
    });

    it("sends nothing when the seat limit blocks it", async () => {
      const staged = member(OrganizationUserStatusType.Staged);
      await setup([staged]);
      selectionModel.select(staged);
      billingConstraint.seatLimitReached.mockResolvedValue(true);

      await run("invite");

      expect(memberActionsService.bulkSendInvite).not.toHaveBeenCalled();
      expect(completed).not.toHaveBeenCalled();
    });

    it("acts on the first 500 in table order and unselects the rest", async () => {
      const members = Array.from({ length: MaxCheckedCount + 2 }, () =>
        member(OrganizationUserStatusType.Staged),
      );
      await setup(members);
      // Selected in reverse, so click order differs from table order.
      selectionModel.select(...[...members].reverse());
      let selectedWhileSending = 0;
      memberActionsService.bulkSendInvite.mockImplementation((_org, ids) => {
        selectedWhileSending = selectionModel.count();
        return of(result(ids));
      });

      await run("invite");

      expect(memberActionsService.bulkSendInvite).toHaveBeenCalledWith(
        expect.anything(),
        members.slice(0, MaxCheckedCount).map((m) => m.id),
      );
      expect(selectedWhileSending).toBe(MaxCheckedCount);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: `invitesSentToast(${MaxCheckedCount})`,
      });
    });

    it("opens the failure dialog with the failed members only, and no toast", async () => {
      const sent = member(OrganizationUserStatusType.Staged);
      const failed = member(OrganizationUserStatusType.Staged);
      await setup([sent, failed]);
      selectionModel.select(sent, failed);
      memberActionsService.bulkSendInvite.mockReturnValue(
        of(result([sent.id], [{ id: failed.id, error: "Seat limit" }])),
      );

      await run("invite");

      expect(memberDialogManager.openBulkActionFailureDialog).toHaveBeenCalledWith(
        [failed],
        [{ id: failed.id, error: "Seat limit" }],
        "inviteDidNotSendTitle",
        "invitesDidNotSendSummary(1,1)",
      );
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(selectionModel.count()).toBe(0);
      expect(completed).toHaveBeenCalled();
    });

    it("fails a sent member the server returned no row for as excluded", async () => {
      const sent = member(OrganizationUserStatusType.Staged);
      const missing = member(OrganizationUserStatusType.Staged);
      await setup([sent, missing]);
      selectionModel.select(sent, missing);
      memberActionsService.bulkSendInvite.mockReturnValue(of(result([sent.id])));

      await run("invite");

      expect(memberDialogManager.openBulkActionFailureDialog).toHaveBeenCalledWith(
        [missing],
        [{ id: missing.id, error: "bulkFilteredMessage" }],
        "inviteDidNotSendTitle",
        "invitesDidNotSendSummary(1,1)",
      );
    });
  });

  describe("Resend invite", () => {
    it("sends every selected member without the v1 retry dialog, using Invite's copy", async () => {
      const members = Array.from({ length: MaxCheckedCount + 2 }, () =>
        member(OrganizationUserStatusType.Invited),
      );
      await setup(members);
      selectionModel.select(...members);
      memberActionsService.bulkReinvite.mockReturnValue(of(result(members.map((m) => m.id))));

      await run("resendInvite");

      expect(memberActionsService.bulkReinvite).toHaveBeenCalledWith(expect.anything(), members, {
        offerRetry: false,
      });
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: `invitesSentToast(${members.length})`,
      });
      expect(selectionModel.count()).toBe(0);
    });

    it("doesn't check the seat limit", async () => {
      const invited = member(OrganizationUserStatusType.Invited);
      await setup([invited]);
      selectionModel.select(invited);
      memberActionsService.bulkReinvite.mockReturnValue(of(result([invited.id])));

      await run("resendInvite");

      expect(billingConstraint.seatLimitReached).not.toHaveBeenCalled();
    });
  });

  describe("Restore access", () => {
    it("restores after the seat limit check and toasts the plural copy", async () => {
      const members = [
        member(OrganizationUserStatusType.Revoked),
        member(OrganizationUserStatusType.Revoked),
      ];
      await setup(members);
      selectionModel.select(...members);
      memberActionsService.bulkRestore.mockReturnValue(of(result(members.map((m) => m.id))));

      await run("restore");

      expect(billingConstraint.seatLimitReached).toHaveBeenCalledWith(
        undefined,
        expect.anything(),
        "restore",
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "membersRestoredToast(2)",
      });
    });

    it("lists every member with the message when the request is rejected as a whole", async () => {
      const members = [
        member(OrganizationUserStatusType.Revoked),
        member(OrganizationUserStatusType.Revoked),
      ];
      await setup(members);
      selectionModel.select(...members);
      const failed = members.map((m) => ({ id: m.id, error: "Seat limit reached" }));
      memberActionsService.bulkRestore.mockReturnValue(of(result([], failed)));

      await run("restore");

      expect(memberDialogManager.openBulkActionFailureDialog).toHaveBeenCalledWith(
        members,
        failed,
        "membersAccessNotRestoredTitle(2)",
        "membersNotRestoredSummary(2,0)",
      );
    });
  });
});
