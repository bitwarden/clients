import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChildren,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { concatMap, filter, Observable, shareReplay, switchMap } from "rxjs";

import { RegistrationUserAddIcon } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTablePaginatorComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  type BitwardenIcon,
  ChipGroupComponent,
  type ChipGroupItem,
  defineTable,
  FilterMenuComponent,
  FilterMenuModule,
  type SelectionConfig,
  StatusLockupComponent,
  SvgComponent,
  type TableRowRange,
} from "@bitwarden/components";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { MaxCheckedCount } from "../../../common/people-table-data-source";
import { OrganizationUserView } from "../../core/views/organization-user.view";
import { SharedOrganizationModule } from "../../shared";
import { AvatarIdPipe } from "../pipes";
import { OrganizationMembersService } from "../services";

/** Badge text and variant per status, listed in the order the Status column sorts. */
const STATUS_BADGES = [
  { status: OrganizationUserStatusType.Staged, labelKey: "staged", variant: "secondary" },
  { status: OrganizationUserStatusType.Invited, labelKey: "invited", variant: "secondary" },
  {
    status: OrganizationUserStatusType.Accepted,
    labelKey: "needsConfirmation",
    variant: "warning",
  },
  { status: OrganizationUserStatusType.Confirmed, labelKey: "active", variant: "success" },
  { status: OrganizationUserStatusType.Revoked, labelKey: "revoked", variant: "secondary" },
] as const;

type StatusBadge = (typeof STATUS_BADGES)[number];

/** The membership columns a chip can filter by, each keyed by the column it filters. */
type MembershipKey = "groupNames" | "collectionNames";

type MemberFilters = Partial<Record<MembershipKey, string[]>>;

@Component({
  templateUrl: "members-v2.component.html",
  imports: [
    AvatarIdPipe,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTablePaginatorComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ChipGroupComponent,
    FilterMenuModule,
    HeaderModule,
    SharedOrganizationModule,
    StatusLockupComponent,
    SvgComponent,
    Vfo1I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersV2Component {
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);
  private readonly memberService = inject(OrganizationMembersService);

  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly emptyIcon = RegistrationUserAddIcon;

  private readonly organization$ = this.route.params.pipe(
    concatMap((params) =>
      this.userId$.pipe(
        switchMap((userId) =>
          this.organizationService.organizations$(userId).pipe(getById(params.organizationId)),
        ),
        filter((organization): organization is Organization => organization != null),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly organization = toSignal(this.organization$);

  protected readonly members = signal<OrganizationUserView[]>([]);
  protected readonly firstLoaded = signal(false);
  protected readonly table = defineTable<OrganizationUserView, "options">(this.members);

  protected readonly showUserManagementControls = computed(
    () => this.organization()?.canManageUsers ?? false,
  );

  /** Select all stops at {@link MaxCheckedCount}, the most members a bulk action accepts. */
  protected readonly selection = computed<SelectionConfig<OrganizationUserView> | undefined>(() =>
    this.showUserManagementControls() ? { multiple: true, max: MaxCheckedCount } : undefined,
  );

  /** Groups for organizations that use them, otherwise collections, as in v1. */
  protected readonly displayedColumns = computed(() => [
    "name" as const,
    "status" as const,
    "type" as const,
    this.organization()?.useGroups ? ("groupNames" as const) : ("collectionNames" as const),
  ]);

  /** Every group a member belongs to, offered as options in the Groups filter. */
  protected readonly groupNames = computed(() => this.distinctNames("groupNames"));

  /** Every collection a member can access, offered as options in the Collections filter. */
  protected readonly collectionNames = computed(() => this.distinctNames("collectionNames"));

  /** Each member's groups as action chips. Built once per load, so chip groups don't remeasure. */
  protected readonly groupChips = computed(() => this.chipsByMember("groupNames", "bwi-users"));

  /** Each member's collections as action chips. */
  protected readonly collectionChips = computed(() =>
    this.chipsByMember("collectionNames", "bwi-collection-shared"),
  );

  private readonly filterMenus = viewChildren(FilterMenuComponent);

  /** Members in any of the selected groups or collections. Names stand in for ids, as on the chips. */
  protected readonly filter = (row: OrganizationUserView, filters: MemberFilters) =>
    this.matchesAny(row.groupNames, filters.groupNames) &&
    this.matchesAny(row.collectionNames, filters.collectionNames);

  constructor() {
    this.organization$
      .pipe(
        switchMap((organization) => this.memberService.loadUsers(organization)),
        takeUntilDestroyed(),
      )
      .subscribe((members) => {
        this.members.set(members);
        this.firstLoaded.set(true);
      });
  }

  /** Narrows the table to members of the chip's group or collection, replacing any prior choice. */
  protected filterBy(key: MembershipKey, name: string) {
    this.filterMenus()
      .find((menu) => menu.key() === key)
      ?.setValue([name]);
  }

  protected statusBadge(status: OrganizationUserStatusType): StatusBadge | undefined {
    return STATUS_BADGES.find((badge) => badge.status === status);
  }

  protected readonly sortByName = (a: OrganizationUserView, b: OrganizationUserView) =>
    this.compareText(a.name ?? a.email, b.name ?? b.email);

  protected readonly sortByStatus = (a: OrganizationUserView, b: OrganizationUserView) =>
    statusOrder(a.status) - statusOrder(b.status);

  /** Orders by the first name shown in the badge, then by how many more there are. */
  protected readonly sortByFirstName = (a: string[], b: string[]) =>
    this.compareText(a[0] ?? "", b[0] ?? "") || a.length - b.length;

  protected readonly sortByGroups = (a: OrganizationUserView, b: OrganizationUserView) =>
    this.sortByFirstName(a.groupNames, b.groupNames);

  protected readonly sortByCollections = (a: OrganizationUserView, b: OrganizationUserView) =>
    this.sortByFirstName(a.collectionNames, b.collectionNames);

  protected readonly rangeLabel = ({ start, end, total }: TableRowRange) => {
    if (total === 0) {
      return this.i18nService.t("memberCount", "0");
    }
    if (total === 1) {
      return this.i18nService.t("memberCountSingular");
    }
    return this.i18nService.t(
      "memberRangeOfTotal",
      start.toString(),
      end.toString(),
      total.toString(),
    );
  };

  private distinctNames(key: MembershipKey): string[] {
    const names = new Set(this.members().flatMap((member) => member[key]));
    return [...names].sort((a, b) => this.compareText(a, b));
  }

  private chipsByMember(
    key: MembershipKey,
    startIcon: BitwardenIcon,
  ): Map<OrganizationUserView, ChipGroupItem[]> {
    return new Map(
      this.members().map((member) => [
        member,
        member[key].map((name) => ({ id: name, label: name, startIcon })),
      ]),
    );
  }

  private matchesAny(names: string[], selected: string[] | undefined): boolean {
    return !selected?.length || selected.some((name) => names.includes(name));
  }

  private compareText(a: string, b: string): number {
    return this.i18nService.collator?.compare(a, b) ?? a.localeCompare(b);
  }
}

function statusOrder(status: OrganizationUserStatusType): number {
  const index = STATUS_BADGES.findIndex((badge) => badge.status === status);
  return index === -1 ? STATUS_BADGES.length : index;
}
