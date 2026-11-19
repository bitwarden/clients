import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { stubTabWidth } from "../testing/stub-tab-width";

import { fitPamColumns, pamFittingColumns, pamHostWidth } from "./pam-table-columns";

type Column = "requester" | "window";

const DROPPABLE = [
  { column: "requester", minWidth: 150 },
  { column: "window", minWidth: 160 },
] as const;

describe("fitPamColumns", () => {
  const shown = (width: number) => [...fitPamColumns<Column>(width, 446, DROPPABLE)];

  it("keeps every column while the width is unmeasured", () => {
    expect(shown(0)).toEqual(["requester", "window"]);
  });

  it("keeps every column once they all fit inside the table's 2px border", () => {
    expect(shown(758)).toEqual(["requester", "window"]);
    expect(shown(1200)).toEqual(["requester", "window"]);
  });

  it("drops the last column first, one pixel short of fitting it", () => {
    expect(shown(757)).toEqual(["requester"]);
    expect(shown(598)).toEqual(["requester"]);
  });

  it("drops every droppable column when only the fixed ones fit", () => {
    expect(shown(597)).toEqual([]);
    expect(shown(283)).toEqual([]);
  });

  it("never shows a less important column in place of a dropped, wider one", () => {
    const columns = fitPamColumns<Column>(290, 100, [
      { column: "window", minWidth: 200 },
      { column: "requester", minWidth: 100 },
    ]);

    // 188px is left: the 100px requester would fit, but it ranks below the window.
    expect([...columns]).toEqual([]);
  });
});

@Component({
  selector: "pam-test-tab",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestTabComponent {
  readonly width = pamHostWidth();
  readonly columns = pamFittingColumns<Column>(446, DROPPABLE);
}

describe("pamHostWidth and pamFittingColumns", () => {
  let tabWidth: ReturnType<typeof stubTabWidth>;
  let fixture: ComponentFixture<TestTabComponent>;

  beforeEach(() => {
    tabWidth = stubTabWidth(633);
    fixture = TestBed.createComponent(TestTabComponent);
  });

  afterEach(() => {
    fixture.destroy();
    tabWidth.restore();
  });

  it("reads the host's width and follows it as it resizes", () => {
    expect(fixture.componentInstance.width()).toBe(633);
    expect([...fixture.componentInstance.columns()]).toEqual(["requester"]);

    tabWidth.setWidth(1000);

    expect(fixture.componentInstance.width()).toBe(1000);
    expect([...fixture.componentInstance.columns()]).toEqual(["requester", "window"]);

    tabWidth.setWidth(283);

    expect([...fixture.componentInstance.columns()]).toEqual([]);
  });

  it("keeps the same set while a resize leaves the fit unchanged", () => {
    const before = fixture.componentInstance.columns();

    tabWidth.setWidth(700);

    expect(fixture.componentInstance.columns()).toBe(before);
  });

  it("stops following the host once destroyed", () => {
    fixture.destroy();
    tabWidth.setWidth(1000);

    expect(fixture.componentInstance.width()).toBe(633);
  });
});
