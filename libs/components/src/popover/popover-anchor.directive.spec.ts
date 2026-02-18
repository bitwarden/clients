import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component, NgZone, TemplateRef, viewChild } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from "@angular/core/testing";
import { Subject } from "rxjs";

import { PopoverAnchorDirective } from "./popover-anchor.directive";
import { PopoverComponent } from "./popover.component";
import { SpotlightService } from "./spotlight.service";

/**
 * Test component to host the directive.
 *
 * Note: When testing RAF (requestAnimationFrame) behavior in fakeAsync tests:
 * - tick() without arguments advances virtual time but does NOT execute RAF callbacks
 * - tick(16) advances time by 16ms (typical animation frame duration) and DOES execute RAF callbacks
 * - tick(0) flushes microtasks, useful for Angular effects that run synchronously
 */
@Component({
  standalone: true,
  template: `
    <div [bitPopoverAnchor]="popoverComponent" [(popoverOpen)]="isOpen" #anchor="popoverAnchor">
      Anchor Element
    </div>
    <bit-popover #popoverComponent></bit-popover>
  `,
  imports: [PopoverAnchorDirective, PopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPopoverAnchorComponent {
  isOpen = false;
  readonly directive = viewChild("anchor", { read: PopoverAnchorDirective });
  readonly popoverComponent = viewChild("popoverComponent", { read: PopoverComponent });
  readonly templateRef = viewChild("anchor", { read: TemplateRef });
}

@Component({
  standalone: true,
  template: `
    <div
      [bitPopoverAnchor]="popoverComponent"
      [(popoverOpen)]="isOpen"
      [spotlight]="true"
      [spotlightPadding]="12"
      #anchor="popoverAnchor"
      style="position: absolute; top: 100px; left: 100px; width: 200px; height: 100px;"
    >
      Anchor Element with Spotlight
    </div>
    <bit-popover #popoverComponent></bit-popover>
  `,
  imports: [PopoverAnchorDirective, PopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPopoverAnchorWithSpotlightComponent {
  isOpen = false;
  readonly directive = viewChild("anchor", { read: PopoverAnchorDirective });
  readonly popoverComponent = viewChild("popoverComponent", { read: PopoverComponent });
}

describe("PopoverAnchorDirective", () => {
  let fixture: ComponentFixture<TestPopoverAnchorComponent>;
  let component: TestPopoverAnchorComponent;
  let directive: PopoverAnchorDirective;
  let overlayRef: Partial<OverlayRef>;
  let overlay: Partial<Overlay>;
  let ngZone: NgZone;

  beforeEach(async () => {
    // Mock ResizeObserver for test environment
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
    }));

    // Create mock overlay ref
    overlayRef = {
      backdropElement: document.createElement("div"),
      attach: jest.fn(),
      detach: jest.fn(),
      dispose: jest.fn(),
      detachments: jest.fn().mockReturnValue(new Subject()),
      keydownEvents: jest.fn().mockReturnValue(new Subject()),
      backdropClick: jest.fn().mockReturnValue(new Subject()),
    };

    // Create mock overlay
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
        block: jest.fn().mockReturnValue({}),
      } as any,
    };

    await TestBed.configureTestingModule({
      imports: [TestPopoverAnchorComponent],
      providers: [{ provide: Overlay, useValue: overlay }, SpotlightService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestPopoverAnchorComponent);
    component = fixture.componentInstance;
    ngZone = TestBed.inject(NgZone);
    fixture.detectChanges();
    directive = component.directive()!;
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe("Initial popover open with RAF delay", () => {
    it("should use double RAF delay on first open", fakeAsync(() => {
      // Spy on requestAnimationFrame to verify it's being called
      const rafSpy = jest.spyOn(window, "requestAnimationFrame");

      // Set popoverOpen signal directly on the directive inside NgZone
      ngZone.run(() => {
        directive.popoverOpen.set(true);
        fixture.detectChanges();
      });

      // After effect execution, RAF should be scheduled but not executed yet
      expect(overlay.create).not.toHaveBeenCalled();

      // Execute first RAF - tick(16) advances time by one animation frame (16ms)
      // This executes the first requestAnimationFrame callback
      tick(16);
      expect(overlay.create).not.toHaveBeenCalled();

      // Execute second RAF - the nested requestAnimationFrame callback
      tick(16);
      expect(overlay.create).toHaveBeenCalled();
      expect(overlayRef.attach).toHaveBeenCalled();

      rafSpy.mockRestore();
      flush();
    }));

    it("should skip RAF delay on subsequent opens", fakeAsync(() => {
      // First open with double RAF delay
      ngZone.run(() => {
        directive.popoverOpen.set(true);
        fixture.detectChanges();
      });
      // Execute both RAF callbacks (16ms each = 32ms total for first open)
      tick(16); // First RAF
      tick(16); // Second RAF
      expect(overlay.create).toHaveBeenCalledTimes(1);
      jest.mocked(overlay.create).mockClear();

      // Close programmatically
      ngZone.run(() => {
        directive.popoverOpen.set(false);
        fixture.detectChanges();
      });

      // Second open should skip RAF delay (hasInitialized is now true)
      ngZone.run(() => {
        directive.popoverOpen.set(true);
        fixture.detectChanges();
      });
      // Only need tick(0) to flush microtasks - NO RAF delay on subsequent opens
      tick(0);
      expect(overlay.create).toHaveBeenCalledTimes(1);

      flush();
    }));
  });

  describe("Programmatic control", () => {
    it("should open popover when popoverOpen is set to true", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
        fixture.detectChanges();
      });
      tick(16);
      tick(16);

      expect(component.isOpen).toBe(true);
      expect(overlay.create).toHaveBeenCalled();

      flush();
    }));

    it("should close popover when popoverOpen is set to false", fakeAsync(() => {
      // Open first
      ngZone.run(() => {
        directive.popoverOpen.set(true);
        fixture.detectChanges();
      });
      tick(16);
      tick(16);

      // Close
      ngZone.run(() => {
        directive.popoverOpen.set(false);
        fixture.detectChanges();
      });

      expect(component.isOpen).toBe(false);
      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));

    it("should close popover when closePopover is called", fakeAsync(() => {
      // Open first
      ngZone.run(() => {
        directive.popoverOpen.set(true);
        fixture.detectChanges();
      });
      tick(16);
      tick(16);

      // Close via method
      directive.closePopover();
      fixture.detectChanges();

      expect(component.isOpen).toBe(false);
      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));
  });

  describe("Race condition prevention", () => {
    it("should prevent multiple RAF scheduling when toggled rapidly", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      // Try to toggle back to false before RAF completes
      ngZone.run(() => {
        directive.popoverOpen.set(false);
      });
      fixture.detectChanges();

      // Try to toggle back to true
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      // Execute RAFs
      tick(16);
      tick(16);

      // Should only create overlay once
      expect(overlay.create).toHaveBeenCalledTimes(1);

      flush();
    }));

    it("should not schedule new RAF if one is already pending", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      // Try to open again while RAF is pending (shouldn't schedule another)
      ngZone.run(() => {
        directive.popoverOpen.set(false);
      });
      fixture.detectChanges();
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      tick(16);
      tick(16);

      // Should only have created one overlay
      expect(overlay.create).toHaveBeenCalledTimes(1);

      flush();
    }));
  });

  describe("Component destruction during RAF", () => {
    it("should cancel RAF callbacks when component is destroyed", fakeAsync(() => {
      const cancelAnimationFrameSpy = jest.spyOn(window, "cancelAnimationFrame");

      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      // Destroy component before RAF completes
      fixture.destroy();

      // Should have cancelled animation frames
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();

      cancelAnimationFrameSpy.mockRestore();

      flush();
    }));

    it("should not create overlay if destroyed during RAF delay", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      // Execute first RAF
      tick(16);

      // Destroy before second RAF
      fixture.destroy();

      // Execute second RAF (should be no-op)
      tick(16);

      expect(overlay.create).not.toHaveBeenCalled();

      flush();
    }));
  });

  describe("Resource cleanup", () => {
    it("should cancel both RAF IDs in disposeAll", fakeAsync(() => {
      const cancelAnimationFrameSpy = jest.spyOn(window, "cancelAnimationFrame");

      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      // Trigger disposal while RAF is pending
      directive.ngOnDestroy();

      // Should cancel animation frames
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();

      cancelAnimationFrameSpy.mockRestore();

      flush();
    }));

    it("should dispose overlay on destroy", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();
      tick(16);
      tick(16);

      expect(overlayRef.attach).toHaveBeenCalled();

      fixture.destroy();

      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));

    it("should unsubscribe from closed events on destroy", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();
      tick(16);
      tick(16);

      // Get the subscription (it's private, so we'll verify via disposal)
      fixture.destroy();

      // Should have disposed overlay which triggers cleanup
      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));
  });

  describe("Overlay guard in openPopover", () => {
    it("should not create duplicate overlay if overlayRef already exists", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();
      tick(16);
      tick(16);

      expect(overlay.create).toHaveBeenCalledTimes(1);

      // Try to set to true again (should not create duplicate since overlay already exists)
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      expect(overlay.create).toHaveBeenCalledTimes(1);

      flush();
    }));

    it("should create new overlay when reopened after close", fakeAsync(() => {
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();
      tick(16);
      tick(16);

      expect(overlay.create).toHaveBeenCalledTimes(1);

      // Close and reopen
      ngZone.run(() => {
        directive.popoverOpen.set(false);
      });
      fixture.detectChanges();
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      // Since we closed and reopened, should create a second overlay
      expect(overlay.create).toHaveBeenCalledTimes(2);

      flush();
    }));
  });
});

describe("PopoverAnchorDirective with Spotlight", () => {
  let fixture: ComponentFixture<TestPopoverAnchorWithSpotlightComponent>;
  let component: TestPopoverAnchorWithSpotlightComponent;
  let directive: PopoverAnchorDirective;
  let overlayRef: Partial<OverlayRef>;
  let overlay: Partial<Overlay>;
  let ngZone: NgZone;

  beforeEach(async () => {
    // Mock ResizeObserver for test environment
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
    }));

    // Create mock overlay ref
    overlayRef = {
      backdropElement: document.createElement("div"),
      attach: jest.fn(),
      detach: jest.fn(),
      dispose: jest.fn(),
      detachments: jest.fn().mockReturnValue(new Subject()),
      keydownEvents: jest.fn().mockReturnValue(new Subject()),
      backdropClick: jest.fn().mockReturnValue(new Subject()),
    };

    // Create mock overlay
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
        block: jest.fn().mockReturnValue({}),
      } as any,
    };

    await TestBed.configureTestingModule({
      imports: [TestPopoverAnchorWithSpotlightComponent],
      providers: [{ provide: Overlay, useValue: overlay }, SpotlightService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestPopoverAnchorWithSpotlightComponent);
    component = fixture.componentInstance;
    ngZone = TestBed.inject(NgZone);
    fixture.detectChanges();
    directive = component.directive()!;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it("should use block scroll strategy when spotlight is enabled", fakeAsync(() => {
    ngZone.run(() => {
      directive.popoverOpen.set(true);
      fixture.detectChanges();
    });
    tick(16);
    tick(16);

    expect(overlay.scrollStrategies.block).toHaveBeenCalled();

    flush();
  }));

  it("should create border element when spotlight is enabled", fakeAsync(() => {
    ngZone.run(() => {
      directive.popoverOpen.set(true);
      fixture.detectChanges();
    });
    tick(16);
    tick(16);

    const borderElement = document.querySelector('[data-spotlight-border="true"]');
    expect(borderElement).toBeTruthy();
    expect((borderElement as HTMLElement).style.zIndex).toBe("1001");

    flush();
  }));
});
