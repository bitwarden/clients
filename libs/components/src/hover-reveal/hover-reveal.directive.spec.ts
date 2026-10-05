import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { HoverRevealContainerDirective, HoverRevealDirective } from "./hover-reveal.directive";

@Component({
  imports: [HoverRevealContainerDirective, HoverRevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div bitHoverRevealContainer class="tw-block" data-testid="container">
      <button type="button" bitHoverReveal class="tw-block" data-testid="reveal">Edit</button>
    </div>
  `,
})
class TestHostComponent {}

describe("HoverReveal directives", () => {
  let el: HTMLElement;

  beforeEach(() => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  const byTestId = (id: string) => el.querySelector(`[data-testid='${id}']`) as HTMLElement;

  it("scopes the reveal variable on the container and resets it inside boundaries", () => {
    const classes = byTestId("container").classList;

    expect(classes).toContain("[--bit-hover-reveal:0]");
    expect(classes).toContain("hover:[--bit-hover-reveal:1]");
    expect(classes).toContain("has-[:focus-visible]:[--bit-hover-reveal:1]");
    expect(classes).toContain("[&:has([data-hover-reveal-boundary]:hover)]:[--bit-hover-reveal:0]");
    expect(classes).toContain("tw-block");
  });

  it("binds the revealed element's opacity to the variable and pins it while expanded", () => {
    const classes = byTestId("reveal").classList;

    expect(classes).toContain("tw-opacity-[var(--bit-hover-reveal,1)]");
    expect(classes).toContain("aria-expanded:tw-opacity-100");
    expect(classes).toContain("tw-block");
  });
});
