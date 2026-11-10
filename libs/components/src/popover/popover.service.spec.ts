import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PopoverPanelComponent } from "./popover-panel.component";
import { PopoverService } from "./popover.service";

@Component({
  selector: "test-host",
  imports: [PopoverPanelComponent],
  template: `
    @if (shown()) {
      <button type="button" #target>Target</button>
      <bit-popover-panel #panel accessibleName="Panel">Panel content</bit-popover-panel>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly shown = signal(true);
  readonly target = viewChild("target", { read: ElementRef<HTMLElement> });
  readonly panel = viewChild.required(PopoverPanelComponent);
}

describe("PopoverService", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let service: PopoverService;

  const overlayText = () => document.querySelector(".cdk-overlay-container")?.textContent ?? "";
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    service = TestBed.inject(PopoverService);
    await settle();
  });

  it("opens on an ElementRef", async () => {
    service.open(fixture.componentInstance.panel(), fixture.componentInstance.target()!);
    await settle();

    expect(overlayText()).toContain("Panel content");
  });

  it("waits for a signal anchor to resolve", async () => {
    const anchor = signal<ElementRef<HTMLElement> | undefined>(undefined);
    service.open(fixture.componentInstance.panel(), anchor);
    await settle();
    expect(overlayText()).not.toContain("Panel content");

    anchor.set(fixture.componentInstance.target());
    await settle();
    expect(overlayText()).toContain("Panel content");
  });

  it("hides without closing while the anchor is gone, then reattaches", async () => {
    const anchor = signal<ElementRef<HTMLElement> | undefined>(fixture.componentInstance.target());
    const ref = service.open(fixture.componentInstance.panel(), anchor);
    const closed = jest.fn();
    ref.closed.subscribe(closed);
    await settle();

    anchor.set(undefined);
    await settle();
    expect(overlayText()).not.toContain("Panel content");
    expect(closed).not.toHaveBeenCalled();

    anchor.set(fixture.componentInstance.target());
    await settle();
    expect(overlayText()).toContain("Panel content");
  });

  it("emits `closed` once and removes the popover on `close()`", async () => {
    const ref = service.open(
      fixture.componentInstance.panel(),
      fixture.componentInstance.target()!,
    );
    const closed = jest.fn();
    ref.closed.subscribe(closed);
    await settle();

    ref.close();
    ref.close();
    await settle();

    expect(closed).toHaveBeenCalledTimes(1);
    expect(overlayText()).not.toContain("Panel content");
  });

  it("closes when the popover's view is destroyed", async () => {
    const ref = service.open(
      fixture.componentInstance.panel(),
      fixture.componentInstance.target()!,
    );
    const closed = jest.fn();
    ref.closed.subscribe(closed);
    await settle();

    fixture.componentInstance.shown.set(false);
    await settle();

    expect(closed).toHaveBeenCalled();
    expect(overlayText()).not.toContain("Panel content");
  });
});
