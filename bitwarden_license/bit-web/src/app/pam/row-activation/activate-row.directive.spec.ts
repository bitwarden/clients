import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { BitCellComponent, BitRowComponent } from "@bitwarden/components";

import { PamActivateRowDirective } from "./activate-row.directive";

@Component({
  imports: [PamActivateRowDirective, BitRowComponent, BitCellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div pamActivateRow data-testid="table">
      <div data-testid="toolbar">Search</div>
      <bit-row data-testid="row">
        <bit-cell>
          <button
            type="button"
            data-pam-row-activator
            data-testid="activator"
            (click)="activated.set(activated() + 1)"
          >
            Item
          </button>
        </bit-cell>
        <bit-cell>
          <span data-testid="plain">Requested by someone</span>
        </bit-cell>
        <bit-cell>
          <button type="button" data-testid="deny" (click)="denied.set(denied() + 1)">Deny</button>
        </bit-cell>
      </bit-row>
      <bit-row data-testid="inert-row">
        <bit-cell><span data-testid="inert-text">Loading</span></bit-cell>
      </bit-row>
    </div>
  `,
})
class TestHostComponent {
  readonly activated = signal(0);
  readonly denied = signal(0);
}

describe("PamActivateRowDirective", () => {
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(() => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const byTestId = (id: string) => el.querySelector<HTMLElement>(`[data-testid='${id}']`)!;

  /** The cell box a row's whitespace belongs to — what a click beside the text lands on. */
  const whitespaceOf = (testId: string) =>
    byTestId(testId).closest<HTMLElement>("bit-cell")!.querySelector<HTMLElement>("[role='cell']")!;

  const click = (target: HTMLElement, init: MouseEventInit = {}) =>
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));

  it("forwards a click on a row's whitespace to that row's activator", () => {
    click(whitespaceOf("plain"));

    expect(host.activated()).toBe(1);
  });

  it("forwards a click on the row element itself", () => {
    click(byTestId("row"));

    expect(host.activated()).toBe(1);
  });

  it("forwards a click on text that owns no action", () => {
    click(byTestId("plain"));

    expect(host.activated()).toBe(1);
  });

  it("activates once when the activator itself is clicked", () => {
    click(byTestId("activator"));

    expect(host.activated()).toBe(1);
  });

  it("leaves another control in the row to its own handler", () => {
    click(byTestId("deny"));

    expect(host.denied()).toBe(1);
    expect(host.activated()).toBe(0);
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
  ])("leaves a %s-click to the browser", (_name, modifier) => {
    click(whitespaceOf("plain"), modifier);

    expect(host.activated()).toBe(0);
  });

  it("ignores a non-primary button", () => {
    click(whitespaceOf("plain"), { button: 1 });

    expect(host.activated()).toBe(0);
  });

  it("ignores a row with no activator", () => {
    click(whitespaceOf("inert-text"));

    expect(host.activated()).toBe(0);
  });

  it("ignores a click outside any row", () => {
    click(byTestId("toolbar"));

    expect(host.activated()).toBe(0);
  });

  it("does not activate when the click ends a drag-select inside the row", () => {
    jest.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      anchorNode: byTestId("plain").firstChild,
      toString: () => "Requested by someone",
    } as unknown as Selection);

    click(whitespaceOf("plain"));

    expect(host.activated()).toBe(0);
  });

  it("activates when the selection sits outside the row", () => {
    jest.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      anchorNode: byTestId("toolbar").firstChild,
      toString: () => "Search",
    } as unknown as Selection);

    click(whitespaceOf("plain"));

    expect(host.activated()).toBe(1);
  });

  it("shows the pointer only on rows that have an activator", () => {
    expect(byTestId("table").classList).toContain(
      "[&_bit-row:has([data-pam-row-activator])]:tw-cursor-pointer",
    );
  });
});
