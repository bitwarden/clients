import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { TooltipDirective } from "../tooltip";

import { BitIconButtonComponent } from "./icon-button.component";

@Component({
  imports: [BitIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      bitIconButton="bwi-clear"
      [label]="label()"
      [bitTooltip]="tooltip()"
    ></button>
  `,
})
class HostComponent {
  readonly label = signal<string | undefined>("Reset search");
  readonly tooltip = signal<string | undefined>(undefined);
}

describe("BitIconButtonComponent tooltip precedence", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const button = () => fixture.nativeElement.querySelector("button") as HTMLButtonElement;

  const tooltipContent = () =>
    fixture.debugElement
      .query(By.directive(TooltipDirective))
      .injector.get(TooltipDirective)
      .tooltipContent();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("derives the tooltip from the label when the caller supplies none", () => {
    expect(tooltipContent()).toBe("Reset search");
    expect(button().getAttribute("aria-label")).toBe("Reset search");
  });

  it("keeps a caller-supplied tooltip distinct from the aria-label", () => {
    host.tooltip.set("Clear by clicking here or pressing Esc.");
    fixture.detectChanges();

    expect(tooltipContent()).toBe("Clear by clicking here or pressing Esc.");
    expect(button().getAttribute("aria-label")).toBe("Reset search");
  });

  it("does not reclaim a caller-supplied tooltip when the label later changes", () => {
    host.tooltip.set("Clear by clicking here or pressing Esc.");
    fixture.detectChanges();

    host.label.set("Reset filter");
    fixture.detectChanges();

    expect(tooltipContent()).toBe("Clear by clicking here or pressing Esc.");
    expect(button().getAttribute("aria-label")).toBe("Reset filter");
  });

  it("keeps a label-derived tooltip in step with the label", () => {
    host.label.set("Reset filter");
    fixture.detectChanges();

    expect(tooltipContent()).toBe("Reset filter");
  });
});
