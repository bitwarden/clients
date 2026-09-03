import { DebugElement, LOCALE_ID } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountWarning, NoResults, RegistrationUserAddIcon } from "@bitwarden/assets/svg";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeComponent,
  BitTablePaginatorComponent,
  BitTableV2Component,
  DialogService,
  FilterMenuComponent,
  SortDirection,
  SvgComponent,
  ToastService,
} from "@bitwarden/components";

import { WebHeaderComponent } from "../../../../../layouts/header/web-header.component";

import {
  MemberAdoptionReportComponent,
  MemberAdoptionTableColumn,
} from "./member-adoption-report.component";
import { MemberAdoptionReportResponse } from "./response/member-adoption-report.response";
import { MemberAdoptionReportApiService } from "./services/member-adoption-report-api.service";
import { memberAdoptionReportPayloadMock } from "./services/member-adoption-report.mock";
import { MemberAdoptionMemberView } from "./view/member-adoption-report.view";

const ORGANIZATION_ID = "5a1c0000-0000-4000-8000-00000000000f" as OrganizationId;

const emptyPayload = {
  totalMemberCount: 0,
  activeMemberCount: 0,
  inactiveMemberCount: 0,
  sponsoredFamiliesRedeemedCount: 0,
  members: [] as unknown[],
};

const payloadWithTotals = (totals: {
  totalMemberCount: number;
  activeMemberCount: number;
  sponsoredFamiliesRedeemedCount?: number;
}) => ({
  ...memberAdoptionReportPayloadMock,
  sponsoredFamiliesRedeemedCount: 0,
  ...totals,
});

describe("MemberAdoptionReportComponent", () => {
  let fixture: ComponentFixture<MemberAdoptionReportComponent>;
  let apiService: MockProxy<MemberAdoptionReportApiService>;
  let logService: MockProxy<LogService>;
  let fileDownloadService: MockProxy<FileDownloadService>;

  async function render(payload: unknown): Promise<void> {
    apiService.getMemberAdoptionData.mockResolvedValue(new MemberAdoptionReportResponse(payload));

    fixture = TestBed.createComponent(MemberAdoptionReportComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function renderFailure(): Promise<void> {
    apiService.getMemberAdoptionData.mockRejectedValue(new Error("boom"));

    fixture = TestBed.createComponent(MemberAdoptionReportComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(id: string): Promise<void> {
    const button = fixture.debugElement.query(By.css(`#${id}`));
    if (button == null) {
      throw new Error(`No rendered button #${id}`);
    }
    (button.nativeElement as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const tileValues = (): string[] =>
    fixture.debugElement
      .queryAll(By.css("[data-testid='tile-value']"))
      .map((tile) => (tile.nativeElement.textContent as string).trim());

  const tileUnits = (): string[] =>
    fixture.debugElement
      .queryAll(By.css("[data-testid='tile-unit']"))
      .map((tile) => (tile.nativeElement.textContent as string).trim());

  const tileSkeletons = (): DebugElement[] =>
    fixture.debugElement.queryAll(By.css("[data-testid='tile-skeleton']"));

  const rows = (): DebugElement[] => fixture.debugElement.queryAll(By.css("bit-row"));

  const headerCells = (): DebugElement[] =>
    fixture.debugElement.queryAll(By.css("[role=columnheader]"));

  const headerLabels = (): string[] =>
    headerCells().map((cell) =>
      (cell.nativeElement.textContent as string).replace(/\s+/g, " ").trim(),
    );

  /** The sort affordance the header cell wraps its content in. */
  const sharedItemsSortButton = (): HTMLButtonElement =>
    headerCells()[4].query(By.css("button")).nativeElement as HTMLButtonElement;

  const rowFor = (email: string): DebugElement => {
    const row = rows().find((candidate) =>
      (candidate.nativeElement.textContent as string).includes(email),
    );
    if (row == null) {
      throw new Error(`No rendered row for ${email}`);
    }
    return row;
  };

  const renderedNames = (): string[] =>
    rows().map((row) => {
      const nameCell = row.query(By.css("[role=cell]")).nativeElement as HTMLElement;
      const secondary = (nameCell.querySelector("[slot=secondary]")?.textContent ?? "").trim();
      const full = (nameCell.textContent ?? "").replace(/\s+/g, " ").trim();
      return secondary ? full.replace(secondary, "").trim() : full;
    });

  const badgesIn = (row: DebugElement): BadgeComponent[] =>
    row.queryAll(By.directive(BadgeComponent)).map((badge) => badge.componentInstance);

  /** The badge variant's default icon: the page passes no `[startIcon]`. */
  const badgeIconsIn = (row: DebugElement): (string | undefined)[] =>
    row.queryAll(By.directive(BadgeComponent)).map((badge) => {
      const icon = badge.query(By.css(".bwi"));
      if (icon == null) {
        return undefined;
      }
      return [...(icon.nativeElement as HTMLElement).classList].find(
        (name) => name.startsWith("bwi-") && name !== "bwi-fw",
      );
    });

  const badgeLabelsIn = (row: DebugElement): string[] =>
    row
      .queryAll(By.directive(BadgeComponent))
      .map((badge) => (badge.nativeElement.textContent as string).trim());

  const table = (): BitTableV2Component<MemberAdoptionMemberView, MemberAdoptionTableColumn> =>
    fixture.debugElement.query(By.directive(BitTableV2Component)).componentInstance;

  const paginator = (): BitTablePaginatorComponent =>
    fixture.debugElement.query(By.directive(BitTablePaginatorComponent)).componentInstance;

  const filterMenu = (key: string): FilterMenuComponent => {
    const menu = fixture.debugElement
      .queryAll(By.directive(FilterMenuComponent))
      .map((found) => found.componentInstance as FilterMenuComponent)
      .find((candidate) => candidate.key() === key);
    if (menu == null) {
      throw new Error(`No filter menu for ${key}`);
    }
    return menu;
  };

  const emptyIcon = (): unknown =>
    (
      fixture.debugElement.query(By.directive(SvgComponent)).componentInstance as SvgComponent
    ).content();

  const retryButton = (): DebugElement =>
    fixture.debugElement.query(By.css("#member-adoption-report_button_retry"));

  /** Page size past twelve, so a sort's last row is the last row overall. */
  const showEveryRow = (): void => {
    paginator().pageSize.set(100);
    fixture.detectChanges();
  };

  const sortBy = (column: MemberAdoptionTableColumn, direction: SortDirection): void => {
    table().sort.set({ column, direction });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    apiService = mock<MemberAdoptionReportApiService>();
    logService = mock<LogService>();
    fileDownloadService = mock<FileDownloadService>();

    const i18nService = mock<I18nService>();
    // Returns the key itself; a key with placeholders reads as `key(arg)`.
    i18nService.t.mockImplementation((id: string, ...args: unknown[]) => {
      // `I18nPipe` always passes three positional arguments, so only the filled ones count.
      const supplied = args.filter((arg) => arg != null);
      return supplied.length > 0 ? `${id}(${supplied.join(", ")})` : id;
    });

    await TestBed.configureTestingModule({
      imports: [MemberAdoptionReportComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ organizationId: ORGANIZATION_ID }),
            data: of({ titleId: "memberAdoptionReport" }),
            queryParams: of({}),
          },
        },
        { provide: MemberAdoptionReportApiService, useValue: apiService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: FileDownloadService, useValue: fileDownloadService },
      ],
    })
      // Keeps the web chrome out of the test.
      .overrideComponent(WebHeaderComponent, { set: { template: "", imports: [] } })
      .compileComponents();
  });

  describe("tiles", () => {
    it("shows the active member count beside the sponsored plan usage", async () => {
      await render(memberAdoptionReportPayloadMock);

      // 8 of 12 active members, 3 of 12 redeemed plans.
      expect(tileValues()).toEqual(["8", "25%"]);
    });

    it("shows 0% rather than NaN% for an organization with no members", async () => {
      await render(emptyPayload);

      expect(tileValues()).toEqual(["0", "0%"]);
    });

    it("groups a large count for the locale", async () => {
      await render(payloadWithTotals({ totalMemberCount: 11999, activeMemberCount: 11999 }));

      expect(tileValues()[0]).toBe("11,999");
    });

    it("groups a large count for a locale that separates thousands differently", async () => {
      TestBed.overrideProvider(LOCALE_ID, { useValue: "de-DE" });

      await render(payloadWithTotals({ totalMemberCount: 11999, activeMemberCount: 11999 }));

      expect(tileValues()[0]).toBe("11.999");
    });

    it("floors a non-zero percentage that rounds to zero, so 0% still means nobody", async () => {
      await render(
        payloadWithTotals({
          totalMemberCount: 1000,
          activeMemberCount: 0,
          sponsoredFamiliesRedeemedCount: 1,
        }),
      );

      expect(tileValues()[1]).toBe("lessThanPercent(1%)");
    });

    it("caps a percentage that rounds to the whole while a member falls short", async () => {
      await render(
        payloadWithTotals({
          totalMemberCount: 1000,
          activeMemberCount: 0,
          sponsoredFamiliesRedeemedCount: 999,
        }),
      );

      expect(tileValues()[1]).toBe("moreThanPercent(99%)");
    });

    it("uses the singular unit for exactly one active member", async () => {
      await render(payloadWithTotals({ totalMemberCount: 12, activeMemberCount: 1 }));

      expect(tileUnits()[0]).toBe("memberLower");
    });

    it("uses the plural unit for any other active member count", async () => {
      await render(memberAdoptionReportPayloadMock);

      expect(tileUnits()[0]).toBe("membersLower");
    });
  });

  describe("table", () => {
    it("falls back to the email for a member with no name", async () => {
      await render(memberAdoptionReportPayloadMock);

      const row = rowFor("invited@example.com");
      // Once, as the primary line.
      expect((row.nativeElement.textContent as string).match(/invited@example\.com/g)).toHaveLength(
        1,
      );
    });

    it("badges a member with a recent login and an extension as a success", async () => {
      await render(memberAdoptionReportPayloadMock);

      const badges = badgesIn(rowFor("atanaka@example.com"));

      expect(badges.map((badge) => badge.variant())).toEqual(["success", "success"]);
      expect(badgeIconsIn(rowFor("atanaka@example.com"))).toEqual([
        "bwi-check-circle",
        "bwi-check-circle",
      ]);
      expect(badgeLabelsIn(rowFor("atanaka@example.com"))).toEqual(["yes", "yes"]);
    });

    it("badges a missing recent login as a warning, not a failure", async () => {
      await render(memberAdoptionReportPayloadMock);

      const badges = badgesIn(rowFor("bwilliams@example.com"));

      expect(badges.map((badge) => badge.variant())).toEqual(["warning", "success"]);
      expect(badgeIconsIn(rowFor("bwilliams@example.com"))).toEqual([
        "bwi-exclamation-triangle",
        "bwi-check-circle",
      ]);
      expect(badgeLabelsIn(rowFor("bwilliams@example.com"))).toEqual(["no", "yes"]);
    });

    it("renders no selection column, so there is nothing to check off", async () => {
      await render(memberAdoptionReportPayloadMock);

      expect(
        fixture.debugElement.queryAll(
          By.css("bit-row input[type=checkbox], bit-header-row input[type=checkbox]"),
        ),
      ).toHaveLength(0);
      expect(table().selectionModel()).toBeUndefined();
      expect(rowFor("atanaka@example.com").queryAll(By.css("[role=cell]"))).toHaveLength(5);
    });
  });

  describe("column headers", () => {
    it("labels every column, the shared items one included", async () => {
      await render(memberAdoptionReportPayloadMock);

      expect(headerLabels()).toEqual([
        "name",
        "recentLogin",
        "extensionUsed",
        "vaultItems",
        "sharedItems",
      ]);
    });

    it("sorts by shared items from its own header", async () => {
      await render(memberAdoptionReportPayloadMock);

      sharedItemsSortButton().click();
      fixture.detectChanges();

      expect(table().sort()).toEqual({ column: "itemsSharedWithThem", direction: "asc" });
      expect(headerCells()[4].nativeElement.getAttribute("aria-sort")).toBe("ascending");
    });
  });

  describe("sorting", () => {
    // Every column is synthetic: none of these names is a field on the row, so each needs a `sortFn`.
    const cases: {
      column: MemberAdoptionTableColumn;
      direction: SortDirection;
      first: string;
      last: string;
    }[] = [
      { column: "name", direction: "asc", first: "Aiko Tanaka", last: "Tomas Krause" },
      { column: "name", direction: "desc", first: "Tomas Krause", last: "Aiko Tanaka" },
      { column: "recentLogin", direction: "asc", first: "Beth Williams", last: "Owen Byrne" },
      { column: "recentLogin", direction: "desc", first: "Sarah Johnson", last: "Nadia Haddad" },
      {
        column: "extensionInstalled",
        direction: "asc",
        first: "James Lull",
        last: "Nadia Haddad",
      },
      {
        column: "extensionInstalled",
        direction: "desc",
        first: "Sarah Johnson",
        last: "Marcus Reed",
      },
      {
        column: "vaultItems",
        direction: "asc",
        first: "invited@example.com",
        last: "Aiko Tanaka",
      },
      {
        column: "vaultItems",
        direction: "desc",
        first: "Aiko Tanaka",
        last: "invited@example.com",
      },
      {
        column: "itemsSharedWithThem",
        direction: "asc",
        first: "Beth Williams",
        last: "Aiko Tanaka",
      },
      {
        column: "itemsSharedWithThem",
        direction: "desc",
        first: "Aiko Tanaka",
        last: "invited@example.com",
      },
    ];

    it.each(cases)(
      "orders $column $direction from $first to $last",
      async ({ column, direction, first, last }) => {
        await render(memberAdoptionReportPayloadMock);
        showEveryRow();

        sortBy(column, direction);

        const ordered = renderedNames();
        expect(ordered).toHaveLength(12);
        expect(ordered[0]).toBe(first);
        expect(ordered[ordered.length - 1]).toBe(last);
      },
    );

    it("orders each count column by its own field rather than the other's", async () => {
      await render(memberAdoptionReportPayloadMock);
      showEveryRow();

      sortBy("vaultItems", "asc");
      const byVaultItems = renderedNames();

      sortBy("itemsSharedWithThem", "asc");
      const bySharedItems = renderedNames();

      expect(byVaultItems).toEqual([
        "invited@example.com",
        "Marcus Reed",
        "Beth Williams",
        "Nadia Haddad",
        "James Lull",
        "Tomas Krause",
        "Owen Byrne",
        "Sarah Johnson",
        "Lena Fischer",
        "Priya Nair",
        "Ray Williams",
        "Aiko Tanaka",
      ]);
      expect(bySharedItems).toEqual([
        "Beth Williams",
        "invited@example.com",
        "Marcus Reed",
        "Nadia Haddad",
        "James Lull",
        "Owen Byrne",
        "Tomas Krause",
        "Sarah Johnson",
        "Lena Fischer",
        "Priya Nair",
        "Ray Williams",
        "Aiko Tanaka",
      ]);
    });
  });

  describe("filters", () => {
    const applyFilter = (key: string, value: string): void => {
      filterMenu(key).toggle(value);
      fixture.detectChanges();
    };

    it("narrows the rows to members without a recent login", async () => {
      await render(memberAdoptionReportPayloadMock);

      applyFilter("recentLogin", "no");

      expect(renderedNames()).toEqual([
        "Beth Williams",
        "invited@example.com",
        "Marcus Reed",
        "Nadia Haddad",
      ]);
    });

    it("narrows the rows to members with the extension installed", async () => {
      await render(memberAdoptionReportPayloadMock);

      applyFilter("extensionInstalled", "yes");

      expect(rows()).toHaveLength(8);
    });

    it("combines both chips", async () => {
      await render(memberAdoptionReportPayloadMock);

      applyFilter("recentLogin", "no");
      applyFilter("extensionInstalled", "yes");

      expect(renderedNames()).toEqual(["Beth Williams", "Nadia Haddad"]);
    });

    it("restores every row when a chip is cleared back to its null cleared value", async () => {
      await render(memberAdoptionReportPayloadMock);
      applyFilter("recentLogin", "no");

      filterMenu("recentLogin").clear();
      fixture.detectChanges();

      // `null`, not `undefined` — the predicate's `filter == null` is what has to catch it.
      expect(filterMenu("recentLogin").value()).toBeNull();
      expect(filterMenu("recentLogin").clearedValue()).toBeNull();
      expect(rows()).toHaveLength(10);
    });
  });

  describe("search", () => {
    // `SearchComponent` is not exported, so `bit-search` is reached by selector.
    const search = (term: string): void => {
      const input = fixture.debugElement.query(By.css("bit-search")).componentInstance as {
        onChange(term: string): void;
      };
      input.onChange(term);
      fixture.detectChanges();
    };

    it("narrows the rows to a matching email", async () => {
      await render(memberAdoptionReportPayloadMock);

      search("nhaddad");

      expect(rows()).toHaveLength(1);
      expect(rows()[0].nativeElement.textContent).toContain("nhaddad@example.com");
    });

    it("narrows the rows to a matching name", async () => {
      await render(memberAdoptionReportPayloadMock);

      search("sarah");

      expect(rows()).toHaveLength(1);
      expect(rows()[0].nativeElement.textContent).toContain("Sarah Johnson");
    });

    it("shows the empty state when nothing matches", async () => {
      await render(memberAdoptionReportPayloadMock);

      search("nobody-by-that-name");

      expect(rows()).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain("noMatchingItems");
      expect(fixture.nativeElement.textContent).toContain("clearFiltersOrTryAnother");
      expect(emptyIcon()).toBe(NoResults);
    });
  });

  describe("pagination", () => {
    it("pages the members ten at a time", async () => {
      await render(memberAdoptionReportPayloadMock);

      expect(rows()).toHaveLength(10);
      expect(renderedNames()[0]).toBe("Aiko Tanaka");
    });

    it("shows the remaining members on the next page", async () => {
      await render(memberAdoptionReportPayloadMock);

      const next = fixture.debugElement.query(By.css("button[bitIconButton='bwi-angle-right']"));
      (next.nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(renderedNames()).toEqual(["Sarah Johnson", "Tomas Krause"]);
    });

    it("shows every member once a larger page size is chosen", async () => {
      await render(memberAdoptionReportPayloadMock);

      fixture.debugElement.query(By.css("bit-select")).triggerEventHandler("ngModelChange", 25);
      fixture.detectChanges();

      expect(rows()).toHaveLength(12);
      expect(paginator().pageSize()).toBe(25);
    });
  });

  describe("export", () => {
    it("downloads every member as a CSV for the organization on screen", async () => {
      await render(memberAdoptionReportPayloadMock);
      apiService.getMemberAdoptionData.mockClear();

      await click("member-adoption-report_button_export");

      expect(apiService.getMemberAdoptionData).toHaveBeenCalledWith(ORGANIZATION_ID);
      expect(fileDownloadService.download).toHaveBeenCalledTimes(1);

      const download = fileDownloadService.download.mock.calls[0][0];
      expect(download.fileName).toMatch(/^bitwarden_member-adoption_export_\d{14}\.csv$/);
      expect(download.blobOptions).toEqual({ type: "text/plain" });
      expect(download.blobData).toContain(
        "Name,Email,Recent login,Extension used,Vault items,Shared items",
      );
      expect(download.blobData).toContain("Sarah Johnson,sjohnson@example.com,yes,yes,42,12");
    });
  });

  describe("empty state", () => {
    it("tells the admin there are no members when the organization has none", async () => {
      await render(emptyPayload);

      expect(rows()).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain("memberAdoptionNoMembers");
      expect(fixture.nativeElement.textContent).toContain("memberAdoptionNoMembersDesc");
      expect(emptyIcon()).toBe(RegistrationUserAddIcon);
    });

    it("offers no retry when the report loaded and simply has nothing to show", async () => {
      await render(emptyPayload);

      expect((retryButton().nativeElement as HTMLElement).classList).toContain("tw-hidden");
    });
  });

  describe("load failure", () => {
    it("logs the organization it failed for, and no member data", async () => {
      await renderFailure();

      expect(logService.error).toHaveBeenCalled();
      const logged = logService.error.mock.calls[0].map((arg) => String(arg)).join(" ");
      expect(logged).toContain(ORGANIZATION_ID);
      expect(logged).not.toContain("@");
      expect(logged).not.toContain("Sarah Johnson");
    });

    it("leaves the table empty and reports nothing as a measured zero", async () => {
      await renderFailure();

      expect(rows()).toHaveLength(0);
      expect(fixture.nativeElement.textContent).not.toContain("0%");
    });

    it("holds every tile at a skeleton rather than formatting an absent report", async () => {
      await renderFailure();

      expect(tileSkeletons()).toHaveLength(2);
      expect(tileValues()).toHaveLength(0);
    });

    it("says the report is missing and offers a retry", async () => {
      await renderFailure();

      expect(fixture.nativeElement.textContent).toContain("memberAdoptionLoadError");
      expect(fixture.nativeElement.textContent).toContain("memberAdoptionLoadErrorDesc");
      expect(emptyIcon()).toBe(AccountWarning);
      expect((retryButton().nativeElement as HTMLElement).classList).not.toContain("tw-hidden");
    });

    it("clears the failure and shows the report once a retry succeeds", async () => {
      await renderFailure();
      apiService.getMemberAdoptionData.mockResolvedValue(
        new MemberAdoptionReportResponse(memberAdoptionReportPayloadMock),
      );

      await click("member-adoption-report_button_retry");

      expect(tileSkeletons()).toHaveLength(0);
      expect(tileValues()).toEqual(["8", "25%"]);
      expect(rows()).toHaveLength(10);
    });
  });
});
