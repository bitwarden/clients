import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverPanelComponent } from "./popover-panel.component";

@Component({
  selector: "test-host",
  imports: [PopoverAnchorForDirective, PopoverPanelComponent],
  template: `
    <div [bitPopoverAnchorFor]="unbound" [popoverOpen]="open()">Host</div>
    <bit-popover-panel #unbound accessibleName="Host">Host popover</bit-popover-panel>

    <div [bitPopoverAnchorFor]="bound" [anchor]="anchor()" [popoverOpen]="open()">Host</div>
    <bit-popover-panel #bound accessibleName="Anchor">Anchor popover</bit-popover-panel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly open = signal(false);
  readonly anchor = signal<HTMLElement | null | undefined>(undefined);
}

describe("PopoverAnchorForDirective", () => {
  let fixture: ComponentFixture<TestHostComponent>;

  const overlayText = () => document.querySelector(".cdk-overlay-container")?.textContent ?? "";

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const update = async (change: (host: TestHostComponent) => void) => {
    change(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const open = () => update((host) => host.open.set(true));

  it("anchors to the host when `anchor` is unbound", async () => {
    await open();

    expect(overlayText()).toContain("Host popover");
  });

  it("waits instead of falling back to the host while a bound `anchor` is undefined", async () => {
    await open();

    expect(overlayText()).not.toContain("Anchor popover");
  });

  it("waits instead of falling back to the host while a bound `anchor` is null", async () => {
    await update((host) => host.anchor.set(null));
    await open();

    expect(overlayText()).not.toContain("Anchor popover");
  });

  it("opens once a bound `anchor` resolves", async () => {
    await open();
    await update((host) => host.anchor.set(document.createElement("button")));

    expect(overlayText()).toContain("Anchor popover");
  });
});
