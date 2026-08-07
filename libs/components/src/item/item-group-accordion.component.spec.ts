import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { ItemModule } from "./item.module";

describe("ItemGroupAccordionComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const trigger = () => fixture.nativeElement.querySelector("button") as HTMLButtonElement;
  const contentPanel = () => fixture.nativeElement.querySelector("[data-accordion-content]");

  it("creates and renders the accordion header with title and subtitle", () => {
    expect(fixture.debugElement.query(By.css("bit-item-group-accordion"))).toBeTruthy();
    const text = trigger().textContent ?? "";
    expect(text).toContain("Logins");
    expect(text).toContain("3 items");
  });

  it("reprojects [slot=end] content into the accordion header, not the body", () => {
    const badge = fixture.nativeElement.querySelector('[data-testid="end-slot"]');
    expect(badge).toBeTruthy();
    // Lives inside the trigger button (header)...
    expect(trigger().contains(badge)).toBe(true);
    // ...and NOT inside the collapsible content region.
    expect(contentPanel().contains(badge)).toBe(false);
  });

  it("projects item rows into a divided list inside the content region", () => {
    const list = contentPanel().querySelector("div.tw-divide-y");
    expect(list).toBeTruthy();
    expect(list.querySelectorAll("bit-item").length).toBe(2);
  });

  it("renders projected items joined — each item drops its own border and radius", () => {
    const item = contentPanel().querySelector("bit-item") as HTMLElement;
    expect(item).toBeTruthy();
    // When joined, the segmented card owns the border/radius, so the item must not draw its own.
    expect(item.classList).not.toContain("tw-border");
    expect(item.classList).not.toContain("tw-rounded-lg");
  });

  it("supports two-way [(open)] — click toggles the host signal", () => {
    expect(host.open()).toBe(false);
    trigger().click();
    fixture.detectChanges();
    expect(host.open()).toBe(true);
  });

  it("opens the panel when the host sets open", () => {
    host.open.set(true);
    fixture.detectChanges();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("forwards disabled — button is disabled and click does not toggle", () => {
    host.disabled.set(true);
    fixture.detectChanges();
    expect(trigger().hasAttribute("disabled")).toBe(true);
    trigger().click();
    fixture.detectChanges();
    expect(host.open()).toBe(false);
  });
});

@Component({
  selector: "test-host",
  template: `
    <bit-item-group-accordion
      title="Logins"
      subtitle="3 items"
      [(open)]="open"
      [disabled]="disabled()"
    >
      <span slot="end" data-testid="end-slot">3</span>
      <bit-item>
        <a bit-item-content href="#">Foo</a>
      </bit-item>
      <bit-item>
        <a bit-item-content href="#">Bar</a>
      </bit-item>
    </bit-item-group-accordion>
  `,
  imports: [ItemModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly open: WritableSignal<boolean> = signal(false);
  readonly disabled: WritableSignal<boolean> = signal(false);
}
