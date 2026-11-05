import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { HoverRevealContainerDirective, HoverRevealDirective } from "../../hover-reveal";

import { BitRowComponent } from "./bit-row.component";

@Component({
  imports: [BitRowComponent, HoverRevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-row>
      <button type="button" bitHoverReveal>Edit</button>
    </bit-row>
  `,
})
class TestHostComponent {}

describe("BitRowComponent", () => {
  it("is a hover reveal container alongside its own row classes", () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const row = fixture.debugElement.query(By.directive(BitRowComponent));

    expect(row.injector.get(HoverRevealContainerDirective, null)).not.toBeNull();
    expect(row.nativeElement.classList).toContain("[--bit-hover-reveal:0]");
    expect(row.nativeElement.classList).toContain("hover:[--bit-hover-reveal:1]");
    expect(row.nativeElement.classList).toContain("tw-grid");
  });
});
