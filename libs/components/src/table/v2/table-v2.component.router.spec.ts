import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FilterMenuModule } from "../../filter-menu";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { defineTable } from "./table-def";
import { BitTableV2Component } from "./table-v2.component";

type Row = { id: number; name: string };

const mockI18nService = { t: (key: string) => key };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    FilterMenuModule,
  ],
  template: `
    <bit-table-v2 [tableDef]="table" queryParam="vault">
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
});
