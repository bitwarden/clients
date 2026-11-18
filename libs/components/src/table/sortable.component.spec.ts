import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { TableDataSource } from "./table-data-source";
import { TableModule } from "./table.module";

@Component({
  selector: "test-host",
  imports: [TableModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table [dataSource]="dataSource">
      <ng-container header>
        <tr>
          <th bitCell bitSortable="name" default>Name</th>
          <th bitCell bitSortable="age">Age</th>
        </tr>
      </ng-container>
      <ng-template body let-rows$>
        @for (row of rows$ | async; track row.name) {
          <tr bitRow>
            <td bitCell>{{ row.name }}</td>
          </tr>
        }
      </ng-template>
    </bit-table>
  `,
})
class TestHostComponent {
  readonly dataSource = new TableDataSource<{ name: string; age: number }>();
}

describe("SortableComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;

  const headers = (): HTMLTableCellElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll("th"));
  const icon = (th: HTMLElement) => th.querySelector("i")!.classList;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("deactivates the previously sorted header when another header is clicked", async () => {
    const [name, age] = headers();
    expect(name.getAttribute("aria-sort")).toBe("ascending");
    expect(icon(name)).toContain("bwi-up-solid");

    age.querySelector("button")!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(age.getAttribute("aria-sort")).toBe("ascending");
    expect(name.getAttribute("aria-sort")).toBeNull();
    expect(icon(name)).toContain("bwi-up-down-btn");
  });

  it("toggles direction when the active header is clicked again", async () => {
    const [name] = headers();

    name.querySelector("button")!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(name.getAttribute("aria-sort")).toBe("descending");
    expect(icon(name)).toContain("bwi-down-solid");
  });
});
