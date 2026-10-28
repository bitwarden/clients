import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { Guid, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";

import { MaxCheckedCount } from "../../../common/people-table-data-source";
import { OrganizationUserView } from "../../core/views/organization-user.view";
import { OrganizationMembersService } from "../services";

import { MembersV2Component } from "./members-v2.component";

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

function member(overrides: Partial<OrganizationUserView> = {}): OrganizationUserView {
  return {
    id: "member",
    name: "Alice",
    email: "alice@example.com",
    status: OrganizationUserStatusType.Confirmed,
    type: OrganizationUserType.User,
    groupNames: [],
    collectionNames: [],
    ...overrides,
  } as OrganizationUserView;
}

describe("MembersV2Component", () => {
  let fixture: ComponentFixture<MembersV2Component>;
  let component: any;
  let memberService: MockProxy<OrganizationMembersService>;
  let i18nService: MockProxy<I18nService>;

  async function setup(organization: Partial<Organization>, members: OrganizationUserView[]) {
    memberService = mock<OrganizationMembersService>();
    memberService.loadUsers.mockResolvedValue(members);

    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string, ...args: unknown[]) => [key, ...args].join(" "));
    Object.defineProperty(i18nService, "collator", { value: new Intl.Collator("en") });

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      of([{ id: ORG_ID, ...organization } as Organization]),
    );

    await TestBed.configureTestingModule({
      imports: [MembersV2Component],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: new BehaviorSubject({ organizationId: ORG_ID }) },
        },
        { provide: AccountService, useValue: mockAccountServiceWith(USER_ID) },
        { provide: OrganizationService, useValue: organizationService },
        { provide: OrganizationMembersService, useValue: memberService },
        { provide: I18nService, useValue: i18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(MembersV2Component, { set: { imports: [], template: "<div></div>" } })
      .compileComponents();

    fixture = TestBed.createComponent(MembersV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it("loads the organization's members", async () => {
    const members = [member()];
    await setup({ canManageUsers: true, useGroups: true }, members);

    expect(memberService.loadUsers).toHaveBeenCalledWith(expect.objectContaining({ id: ORG_ID }));
    expect(component.members()).toEqual(members);
    expect(component.firstLoaded()).toBe(true);
  });

  describe("displayedColumns", () => {
    it("shows Groups when the organization uses groups", async () => {
      await setup({ useGroups: true }, []);

      expect(component.displayedColumns()).toEqual(["name", "status", "type", "groupNames"]);
    });

    it("shows Collections when the organization doesn't use groups", async () => {
      await setup({ useGroups: false }, []);

      expect(component.displayedColumns()).toEqual(["name", "status", "type", "collectionNames"]);
    });
  });

  describe("selection", () => {
    it("is capped at MaxCheckedCount when the admin can manage users", async () => {
      await setup({ canManageUsers: true }, []);

      expect(component.selection()).toEqual({ multiple: true, max: MaxCheckedCount });
    });

    it("is off when the admin can't manage users", async () => {
      await setup({ canManageUsers: false }, []);

      expect(component.selection()).toBeUndefined();
    });
  });

  describe("sorting", () => {
    beforeEach(async () => {
      await setup({}, []);
    });

    it("sorts by name, falling back to email when there's no name", () => {
      const rows = [
        member({ name: "Carol" }),
        member({ name: undefined, email: "bob@example.com" }),
        member({ name: "Alice" }),
      ];

      expect(rows.sort(component.sortByName).map((r) => r.name ?? r.email)).toEqual([
        "Alice",
        "bob@example.com",
        "Carol",
      ]);
    });

    it("sorts by status in badge order", () => {
      const rows = [
        OrganizationUserStatusType.Revoked,
        OrganizationUserStatusType.Confirmed,
        OrganizationUserStatusType.Accepted,
        OrganizationUserStatusType.Invited,
        OrganizationUserStatusType.Staged,
      ].map((status) => member({ status }));

      expect(rows.sort(component.sortByStatus).map((r) => r.status)).toEqual([
        OrganizationUserStatusType.Staged,
        OrganizationUserStatusType.Invited,
        OrganizationUserStatusType.Accepted,
        OrganizationUserStatusType.Confirmed,
        OrganizationUserStatusType.Revoked,
      ]);
    });

    it("sorts groups by the first group, then by how many there are", () => {
      const rows = [
        member({ id: "b" as Guid, groupNames: ["Sales"] }),
        member({ id: "a2" as Guid, groupNames: ["Admins", "Sales"] }),
        member({ id: "none" as Guid, groupNames: [] }),
        member({ id: "a1" as Guid, groupNames: ["Admins"] }),
      ];

      expect(rows.sort(component.sortByGroups).map((r) => r.id)).toEqual(["none", "a1", "a2", "b"]);
    });
  });

  describe("membership chips", () => {
    const members = [
      member({ id: "a" as Guid, groupNames: ["Sales", "Admins"] }),
      member({ id: "b" as Guid, groupNames: ["Admins"] }),
      member({ id: "c" as Guid, groupNames: [] }),
    ];

    beforeEach(async () => {
      await setup({ useGroups: true }, members);
    });

    it("offers each group once, sorted, as a filter option", () => {
      expect(component.groupNames()).toEqual(["Admins", "Sales"]);
    });

    it("builds a chip per group for each member", () => {
      expect(component.groupChips().get(members[0])).toEqual([
        { id: "Sales", label: "Sales", startIcon: "bwi-users" },
        { id: "Admins", label: "Admins", startIcon: "bwi-users" },
      ]);
      expect(component.groupChips().get(members[2])).toEqual([]);
    });

    it("keeps every member when no group is selected", () => {
      expect(members.filter((m) => component.filter(m, {}))).toEqual(members);
      expect(members.filter((m) => component.filter(m, { groupNames: [] }))).toEqual(members);
    });

    it("keeps members in any selected group", () => {
      expect(
        members.filter((m) => component.filter(m, { groupNames: ["Sales"] })).map((m) => m.id),
      ).toEqual(["a"]);
      expect(
        members
          .filter((m) => component.filter(m, { groupNames: ["Sales", "Admins"] }))
          .map((m) => m.id),
      ).toEqual(["a", "b"]);
    });
  });

  describe("rangeLabel", () => {
    beforeEach(async () => {
      await setup({}, []);
    });

    it("reads the page range and the total", () => {
      expect(component.rangeLabel({ start: 1, end: 10, total: 150 })).toBe(
        "memberRangeOfTotal 1 10 150",
      );
    });

    it("reads 0 members when there are none", () => {
      expect(component.rangeLabel({ start: 0, end: 0, total: 0 })).toBe("memberCount 0");
    });

    it("uses the singular for one member", () => {
      expect(component.rangeLabel({ start: 1, end: 1, total: 1 })).toBe("memberCountSingular");
    });
  });
});
