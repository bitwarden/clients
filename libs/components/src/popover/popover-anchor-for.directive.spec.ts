import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverPanelComponent } from "./popover-panel.component";

@Component({
  selector: "test-host",
  imports: [PopoverAnchorForDirective, PopoverPanelComponent],
  template: `
    <div [bitPopoverAnchorFor]="popover" [popoverOpen]="open()">Host</div>
    <bit-popover-panel #popover accessibleName="Host">Host popover</bit-popover-panel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly open = signal(false);
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

  it("opens anchored to the host", async () => {
    await open();

    expect(overlayText()).toContain("Host popover");
  });
});
