import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, flush } from "@angular/core/testing";
import { Subject } from "rxjs";

import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverComponent } from "./popover.component";
import { SpotlightService } from "./spotlight.service";

@Component({
  template: `
    <button
      type="button"
      [bitPopoverTriggerFor]="popoverComponent"
      [(popoverOpen)]="isOpen"
      #trigger="popoverTrigger"
    >
      Trigger
    </button>
    <bit-popover #popoverComponent></bit-popover>
  `,
  imports: [PopoverTriggerForDirective, PopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPopoverTriggerComponent {
  isOpen = false;
}

describe("PopoverTriggerForDirective", () => {
  let fixture: ComponentFixture<TestPopoverTriggerComponent>;
  let overlayRef: Partial<OverlayRef>;
  let overlay: Partial<Overlay>;

  beforeEach(async () => {
    overlayRef = {
      backdropElement: document.createElement("div"),
      attach: jest.fn(),
      detach: jest.fn(),
      dispose: jest.fn(),
      detachments: jest.fn().mockReturnValue(new Subject()),
      keydownEvents: jest.fn().mockReturnValue(new Subject()),
      backdropClick: jest.fn().mockReturnValue(new Subject()),
    };

    const mockPositionStrategy = {
      flexibleConnectedTo: jest.fn().mockReturnThis(),
      withPositions: jest.fn().mockReturnThis(),
      withLockedPosition: jest.fn().mockReturnThis(),
      withFlexibleDimensions: jest.fn().mockReturnThis(),
      withPush: jest.fn().mockReturnThis(),
    };

    overlay = {
      create: jest.fn().mockReturnValue(overlayRef),
      position: jest.fn().mockReturnValue(mockPositionStrategy),
      scrollStrategies: {
        reposition: jest.fn().mockReturnValue({}),
      } as any,
    };

    await TestBed.configureTestingModule({
      imports: [TestPopoverTriggerComponent],
      providers: [{ provide: Overlay, useValue: overlay }, SpotlightService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestPopoverTriggerComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  describe("Click handling", () => {
    it("should open popover on click when closed", fakeAsync(() => {
      const button = fixture.nativeElement.querySelector("button");
      button.click();
      fixture.detectChanges();

      expect(overlay.create).toHaveBeenCalled();
      expect(overlayRef.attach).toHaveBeenCalled();

      flush();
    }));

    it("should close popover on click when open", fakeAsync(() => {
      const button = fixture.nativeElement.querySelector("button");

      // Open
      button.click();
      fixture.detectChanges();
      expect(overlay.create).toHaveBeenCalledTimes(1);

      // Close
      button.click();
      fixture.detectChanges();
      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));

    it("should not process clicks after component is destroyed", fakeAsync(() => {
      const button = fixture.nativeElement.querySelector("button");
      button.click();
      fixture.detectChanges();

      const createCount = jest.mocked(overlay.create).mock.calls.length;
      fixture.destroy();

      button.click();

      expect(overlay.create).toHaveBeenCalledTimes(createCount);

      flush();
    }));
  });

  describe("aria-expanded", () => {
    it("should be false when closed", () => {
      const button = fixture.nativeElement.querySelector("button");
      expect(button.getAttribute("aria-expanded")).toBe("false");
    });

    it("should be true when open", fakeAsync(() => {
      const button = fixture.nativeElement.querySelector("button");
      button.click();
      fixture.detectChanges();

      expect(button.getAttribute("aria-expanded")).toBe("true");

      flush();
    }));
  });

  describe("Resource cleanup", () => {
    it("should dispose overlay on destroy", fakeAsync(() => {
      const button = fixture.nativeElement.querySelector("button");
      button.click();
      fixture.detectChanges();

      fixture.destroy();

      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));
  });
});
