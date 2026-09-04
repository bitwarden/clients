import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogService } from "../../dialog";
import { ScrollLayoutService } from "../../layout/scroll-layout.directive";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { defineTable } from "./table-def";
import { BitTableV2Component } from "./table-v2.component";

type Row = { id: number; name: string };

const mockI18nService = { t: (key: string) => key };

/**
 * A `fill` table as a page mounts one. `scrollLayoutHost` is an input so one host covers both.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
  ],
  template: `
    <bit-table-v2
      [tableDef]="table"
      height="fill"
      [virtualRowHeight]="56"
      [scrollLayoutHost]="host()"
    >
      <bit-column name="name">
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="let row">{{ row.name }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class TestHostComponent {
  readonly host = signal(false);
  readonly rows = signal<Row[]>([{ id: 1, name: "one" }]);
  readonly table = defineTable<Row>(this.rows);
}

describe("BitTableV2Component scroll layout host", () => {
  let scrollLayout: ScrollLayoutService;

  async function render(host: boolean) {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: DialogService, useValue: {} },
      ],
    }).compileComponents();

    scrollLayout = TestBed.inject(ScrollLayoutService);

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.host.set(host);
    fixture.detectChanges();

    return fixture;
  }

  it("does not claim the scroll region by default", async () => {
    await render(false);

    expect(scrollLayout.scrollableRef()).toBeNull();
  });

  it("registers its scrolling body as the scroll region when opted in", async () => {
    await render(true);

    const registered = scrollLayout.scrollableRef();

    expect(registered).not.toBeNull();
    // The body the rows scroll in, not the table's own host element.
    expect(registered!.nativeElement.classList).toContain("cdk-virtual-scroll-viewport");
  });

  it("hands the region back when the table is destroyed", async () => {
    const fixture = await render(true);

    expect(scrollLayout.scrollableRef()).not.toBeNull();

    fixture.destroy();

    expect(scrollLayout.scrollableRef()).toBeNull();
  });
});
