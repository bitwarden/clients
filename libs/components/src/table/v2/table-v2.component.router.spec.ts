import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router, provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogService } from "../../dialog";
import { FilterMenuModule } from "../../filter-menu";
import { SearchComponent } from "../../search/search.component";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { BitTableToolbarComponent } from "./bit-table-toolbar.component";
import { defineTable } from "./table-def";
import { BitTableV2Component } from "./table-v2.component";

type Row = { id: number; name: string };

const mockI18nService = { t: (key: string) => key };
const mockDialogService = {};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    FilterMenuModule,
    SearchComponent,
    BitTableToolbarComponent,
  ],
  template: `
    <bit-table-v2 [tableDef]="table" queryParam="vault">
      <bit-table-toolbar>
        <bit-search />
      </bit-table-toolbar>

      <bit-filter-menu key="type" placeholderText="Type">
        <bit-filter-option [value]="'login'">Login</bit-filter-option>
      </bit-filter-menu>

      <!-- Mirrors the "Shared folders" chip: mounted only once its options (a
           collections stream) have resolved, well after the table's first render. -->
      @if (showSharedFolder()) {
        <bit-filter-menu key="sharedFolder" placeholderText="Shared folders" multiple>
          @for (id of collectionIds(); track id) {
            <bit-filter-option [value]="id">{{ id }}</bit-filter-option>
          }
        </bit-filter-menu>
      }

      <bit-column>
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class TestHostComponent {
  protected readonly table = defineTable<Row>(signal<Row[]>([{ id: 1, name: "Row" }]));
  readonly showSharedFolder = signal(false);
  readonly collectionIds = signal<string[]>([]);
}

describe("BitTableV2Component (router integration)", () => {
  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: "**", component: TestHostComponent }]),
        { provide: I18nService, useValue: mockI18nService },
        { provide: DialogService, useValue: mockDialogService },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    return { harness, router: TestBed.inject(Router) };
  }

  it("preserves a query param owned by a filter chip that hasn't registered yet", async () => {
    const { router, harness } = await setup("/?vault.sharedFolder=abc123");
    const host = harness.routeDebugElement!.componentInstance as TestHostComponent;

    // The table has already restored/written back once (for the "type" chip and
    // sort/pagination) by this point, before the sharedFolder chip ever registers.
    expect(router.url).toContain("vault.sharedFolder=abc123");

    // The sharedFolder chip mounts once its options resolve, and registers with the table.
    host.showSharedFolder.set(true);
    host.collectionIds.set(["abc123"]);
    harness.detectChanges();
    await harness.fixture.whenStable();

    // Its own seeding effect should have picked up the still-present URL value...
    expect(router.url).toContain("vault.sharedFolder=abc123");
  });

  // The store types params by shape, so an all-digit term decodes to a number. It has to
  // reach `bit-search` (and `filterValues`) as a string — `SearchService.isSearchable`
  // calls `trim()` on it, and a number there throws and silently disables search.
  it("seeds an all-digit search term from the URL as a string", async () => {
    const { harness } = await setup("/?vault.search=2024");

    const search = harness.fixture.debugElement.query(By.directive(SearchComponent))
      .componentInstance as SearchComponent;
    const table = harness.fixture.debugElement.query(By.directive(BitTableV2Component))
      .componentInstance as BitTableV2Component<Row>;

    expect(search.value()).toBe("2024");
    expect(table.filterValues().search).toBe("2024");
  });
});
