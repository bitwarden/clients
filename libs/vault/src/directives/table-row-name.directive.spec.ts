import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { TableRowNameDirective } from "./table-row-name.directive";

@Component({
  selector: "test-table-row-name-host",
  imports: [TableRowNameDirective],
  template: `
    <a vaultTableRowName href="/folder" class="tw-block">Engineering</a>
    <button vaultTableRowName type="button">Amazon</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {}

describe("TableRowNameDirective", () => {
  let host: HTMLElement;

  beforeEach(() => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  it.each(["a", "button"])("styles a %s as the row's plain-text name", (tag) => {
    const classes = Array.from(host.querySelector(tag)!.classList);

    expect(classes).toEqual(
      expect.arrayContaining([
        "!tw-text-fg-heading",
        "tw-font-medium",
        "tw-text-base",
        "tw-no-underline",
        "tw-truncate",
      ]),
    );
  });

  it("keeps classes the template sets alongside its own", () => {
    const classes = Array.from(host.querySelector("a")!.classList);

    expect(classes).toEqual(expect.arrayContaining(["tw-block", "!tw-text-fg-heading"]));
  });
});
