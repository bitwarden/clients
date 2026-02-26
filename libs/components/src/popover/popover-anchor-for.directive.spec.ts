import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { DomPortal } from "@angular/cdk/portal";
import { ChangeDetectionStrategy, Component, NgZone, TemplateRef, viewChild } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, flush } from "@angular/core/testing";
import { Subject } from "rxjs";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverComponent } from "./popover.component";
import { SpotlightService } from "./spotlight.service";

/**
 * Test component to host the directive.
 *
 * Note: On first open, the directive uses afterNextRender to wait for layout to stabilize.
 * In TestBed, afterNextRender fires synchronously within the same detectChanges() call,
 * so tests do not observe a deferral. The deferral only manifests in a real browser environment.
 */
@Component({
  standalone: true,
  template: `
    <div [bitPopoverAnchorFor]="popoverComponent" [(popoverOpen)]="isOpen" #anchor="popoverAnchor">
      Anchor Element
    </div>
    <bit-popover #popoverComponent></bit-popover>
  `,
  imports: [PopoverAnchorForDirective, PopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPopoverAnchorComponent {
  isOpen = false;
  readonly directive = viewChild("anchor", { read: PopoverAnchorForDirective });
  readonly popoverComponent = viewChild("popoverComponent", { read: PopoverComponent });
  readonly templateRef = viewChild("anchor", { read: TemplateRef });
}

@Component({
  standalone: true,
  template: `
    <div
      [bitPopoverAnchorFor]="popoverComponent"
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
  imports: [PopoverAnchorForDirective, PopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPopoverAnchorWithSpotlightComponent {
  isOpen = false;
  readonly directive = viewChild("anchor", { read: PopoverAnchorForDirective });
  readonly popoverComponent = viewChild("popoverComponent", { read: PopoverComponent });
}

describe("PopoverAnchorForDirective", () => {
  let fixture: ComponentFixture<TestPopoverAnchorComponent>;
  let component: TestPopoverAnchorComponent;
  let directive: PopoverAnchorForDirective;
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

  function openPopover() {
    ngZone.run(() => {
      directive.popoverOpen.set(true);
      fixture.detectChanges();
    });
  }

  describe("Initial popover open", () => {
    it("should open popover on first open", fakeAsync(() => {
      openPopover();

      expect(overlay.create).toHaveBeenCalled();
      expect(overlayRef.attach).toHaveBeenCalled();

      flush();
    }));

    it("should open on subsequent opens", fakeAsync(() => {
      openPopover();
      expect(overlay.create).toHaveBeenCalledTimes(1);
      jest.mocked(overlay.create).mockClear();

      ngZone.run(() => {
        directive.popoverOpen.set(false);
        fixture.detectChanges();
      });

      openPopover();
      expect(overlay.create).toHaveBeenCalledTimes(1);

      flush();
    }));
  });

  describe("Programmatic control", () => {
    it("should open popover when popoverOpen is set to true", fakeAsync(() => {
      openPopover();

      expect(component.isOpen).toBe(true);
      expect(overlay.create).toHaveBeenCalled();

      flush();
    }));

    it("should close popover when popoverOpen is set to false", fakeAsync(() => {
      openPopover();

      ngZone.run(() => {
        directive.popoverOpen.set(false);
        fixture.detectChanges();
      });

      expect(component.isOpen).toBe(false);
      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));

    it("should close popover when closePopover is called", fakeAsync(() => {
      openPopover();

      directive.closePopover();
      fixture.detectChanges();

      expect(component.isOpen).toBe(false);
      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));
  });

  describe("Resource cleanup", () => {
    it("should dispose overlay on destroy", fakeAsync(() => {
      openPopover();
      expect(overlayRef.attach).toHaveBeenCalled();

      fixture.destroy();

      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));

    it("should unsubscribe from closed events on destroy", fakeAsync(() => {
      openPopover();

      fixture.destroy();

      expect(overlayRef.dispose).toHaveBeenCalled();

      flush();
    }));
  });

  describe("Overlay guard in openPopover", () => {
    it("should not create duplicate overlay if overlayRef already exists", fakeAsync(() => {
      openPopover();
      expect(overlay.create).toHaveBeenCalledTimes(1);

      // Set to true again — overlay already exists, no duplicate created
      ngZone.run(() => {
        directive.popoverOpen.set(true);
      });
      fixture.detectChanges();

      expect(overlay.create).toHaveBeenCalledTimes(1);

      flush();
    }));

    it("should create new overlay when reopened after close", fakeAsync(() => {
      openPopover();
      expect(overlay.create).toHaveBeenCalledTimes(1);

      // Close and reopen
      ngZone.run(() => {
        directive.popoverOpen.set(false);
        fixture.detectChanges();
      });
      ngZone.run(() => {
        directive.popoverOpen.set(true);
        fixture.detectChanges();
      });

      expect(overlay.create).toHaveBeenCalledTimes(2);

      flush();
    }));
  });
});

describe("PopoverAnchorForDirective with Spotlight", () => {
  let fixture: ComponentFixture<TestPopoverAnchorWithSpotlightComponent>;
  let component: TestPopoverAnchorWithSpotlightComponent;
  let directive: PopoverAnchorForDirective;
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

  function openPopover() {
    ngZone.run(() => {
      directive.popoverOpen.set(true);
      fixture.detectChanges();
    });
    fixture.detectChanges();
  }

  it("should use reposition scroll strategy when spotlight is enabled", fakeAsync(() => {
    openPopover();

    expect(overlay.scrollStrategies.reposition).toHaveBeenCalled();

    flush();
  }));

  it("should create a CDK border overlay when spotlight is enabled", fakeAsync(() => {
    openPopover();

    // overlay.create is called twice: first by SpotlightService (border element overlay),
    // then by the directive (popover) — ensuring the popover pane sits above the border in DOM order
    expect(overlay.create).toHaveBeenCalledTimes(2);

    // The first attach call should be a DomPortal (spotlight border)
    const firstAttachArg = jest.mocked(overlayRef.attach).mock.calls[0][0];
    expect(firstAttachArg).toBeInstanceOf(DomPortal);

    flush();
  }));
});
