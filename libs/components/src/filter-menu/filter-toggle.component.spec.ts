import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { TooltipDirective } from "../tooltip";

import { FilterToggleComponent } from "./filter-toggle.component";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterToggleComponent],
  template: `
    <bit-filter-toggle key="favorites" [label]="label" icon="bwi-star" disabled></bit-filter-toggle>
  `,
})
class DisabledToggleHostComponent {
  readonly label = "A favorites label long enough to truncate in the chip";
}

/**
 * A disabled toggle is `aria-disabled`, not `disabled`, so it stays focusable and a
 * `disabledTooltip` can still reach a keyboard user. `flip()` is what keeps it inert, not the
 * missing attribute.
 */
describe("FilterToggleComponent disabled", () => {
  let fixture: ComponentFixture<DisabledToggleHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledToggleHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DisabledToggleHostComponent);
    fixture.detectChanges();
  });

  const chip = () =>
    fixture.debugElement.query(By.css("button")).nativeElement as HTMLButtonElement;

  it("marks the chip `aria-disabled` and leaves it focusable", () => {
    expect(chip().getAttribute("aria-disabled")).toBe("true");
    expect(chip().hasAttribute("disabled")).toBe(false);
    expect(chip().disabled).toBe(false);
  });

  it("leaves the chip untooltipped when disabled with no reason supplied", () => {
    const tooltip = fixture.debugElement.query(By.css("button")).injector.get(TooltipDirective);

    expect(tooltip.tooltipContent()).toBe("");
  });

  it("does not flip when the disabled chip is clicked", () => {
    const toggle = fixture.debugElement.query(By.directive(FilterToggleComponent))
      .componentInstance as FilterToggleComponent;

    chip().click();
    fixture.detectChanges();

    expect(toggle.active()).toBe(false);
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterToggleComponent],
  template: `
    <bit-filter-toggle
      key="favorites"
      label="Favorites"
      icon="bwi-star"
      [disabled]="off()"
      [disabledTooltip]="reason()"
    ></bit-filter-toggle>
  `,
})
class DisabledReasonHostComponent {
  readonly reason = signal("No favorites to show");
  readonly off = signal(true);
}

/**
 * `disabledTooltip` is the reason a chip is disabled — something the label can't convey. It is the
 * chip's only tooltip, and it reaches assistive tech via the chip's `aria-describedby`.
 */
describe("FilterToggleComponent disabledTooltip", () => {
  let fixture: ComponentFixture<DisabledReasonHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledReasonHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DisabledReasonHostComponent);
    fixture.detectChanges();
  });

  const chipEl = () =>
    fixture.debugElement.query(By.css("button")).nativeElement as HTMLButtonElement;

  const tooltip = () => fixture.debugElement.query(By.css("button")).injector.get(TooltipDirective);

  it("tooltips the chip with the reason while disabled", () => {
    expect(tooltip().tooltipContent()).toBe("No favorites to show");
  });

  it("describes the chip with the reason, so a keyboard user hears why", () => {
    const id = chipEl().getAttribute("aria-describedby");
    expect(id).toBeTruthy();

    chipEl().dispatchEvent(new MouseEvent("mouseenter"));
    fixture.detectChanges();

    expect(document.getElementById(id!)?.textContent?.trim()).toBe("No favorites to show");
  });

  it("gives the disabled chip pointer events back so the reason is hoverable", () => {
    expect(chipEl().classList).toContain("tw-pointer-events-auto");
  });

  it("drops the tooltip, and describes nothing, once enabled", () => {
    fixture.componentInstance.off.set(false);
    fixture.detectChanges();

    expect(tooltip().tooltipContent()).toBe("");
    expect(chipEl().hasAttribute("aria-describedby")).toBe(false);
  });
});
