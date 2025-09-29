import {
  ConnectedOverlayPositionChange,
  ConnectionPositionPair,
  FlexibleConnectedPositionStrategy,
  OverlayConfig,
  Overlay,
} from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Observable, Subject } from "rxjs";

import { TooltipDirective } from "./tooltip.directive";

type TooltipPositionId = "above-center" | "below-center" | "left-center" | "right-center";

/** Minimal strategy surface the directive uses */
interface StrategyLike {
  withFlexibleDimensions: (flex: boolean) => StrategyLike;
  withPush: (push: boolean) => StrategyLike;
  withPositions: (positions: ReadonlyArray<ConnectionPositionPair>) => StrategyLike;
  readonly positionChanges: Observable<ConnectedOverlayPositionChange>;
}

/** Minimal Overlay service surface we need */
interface OverlayLike {
  position: () => { flexibleConnectedTo: (_: unknown) => StrategyLike };
  create: (_: OverlayConfig) => OverlayRefStub;
  scrollStrategies: { reposition: () => unknown };
}

interface OverlayRefStub {
  attach: (portal: ComponentPortal<unknown>) => unknown; // no setInput in new impl
  updatePosition: () => void;
}

@Component({
  standalone: true,
  imports: [TooltipDirective],
  template: `
    <button [bitTooltip]="tooltipText" [tooltipPosition]="currentPosition" type="button">
      Hover me
    </button>
  `,
})
class TooltipHostComponent {
  tooltipText = "Hello Tooltip";
  currentPosition: TooltipPositionId = "above-center";
}

describe("TooltipDirective (signals + DI)", () => {
  let fixture: ComponentFixture<TooltipHostComponent>;
  let positionChanges$: Subject<ConnectedOverlayPositionChange>;

  beforeEach(() => {
    positionChanges$ = new Subject<ConnectedOverlayPositionChange>();

    // Chainable strategy mock
    const strategy: StrategyLike = {
      withFlexibleDimensions: jest.fn(() => strategy),
      withPush: jest.fn(() => strategy),
      withPositions: jest.fn(() => strategy),
      get positionChanges() {
        return positionChanges$.asObservable();
      },
    };

    const overlayRefStub: OverlayRefStub = {
      attach: (_portal: ComponentPortal<unknown>) => ({}), // directive doesn't use setInput now
      updatePosition: jest.fn(),
    };

    const overlayMock: OverlayLike = {
      position: () => ({
        flexibleConnectedTo: () => strategy,
      }),
      create: (_: OverlayConfig) => overlayRefStub,
      scrollStrategies: { reposition: () => ({}) },
    };

    TestBed.configureTestingModule({
      imports: [TooltipHostComponent],
      providers: [{ provide: Overlay, useValue: overlayMock as unknown as Overlay }],
    });

    fixture = TestBed.createComponent(TooltipHostComponent);
    fixture.detectChanges();
  });

  function getDirective(): TooltipDirective {
    const hostDebugEl = fixture.debugElement.query(By.directive(TooltipDirective));
    return hostDebugEl.injector.get(TooltipDirective);
  }

  it("toggles visibility signal on hover/focus", () => {
    const hostBtn: HTMLButtonElement = fixture.debugElement.query(By.css("button")).nativeElement;
    const directive = getDirective();

    const isVisible = (directive as unknown as { isVisible: () => boolean }).isVisible;

    hostBtn.dispatchEvent(new Event("mouseenter"));
    expect(isVisible()).toBe(true);

    hostBtn.dispatchEvent(new Event("mouseleave"));
    expect(isVisible()).toBe(false);

    hostBtn.dispatchEvent(new Event("focus"));
    expect(isVisible()).toBe(true);

    hostBtn.dispatchEvent(new Event("blur"));
    expect(isVisible()).toBe(false);
  });

  it("updates strategy and overlay when tooltipPosition input changes", () => {
    const directive = getDirective();

    const strategy = (
      directive as unknown as { positionStrategy: FlexibleConnectedPositionStrategy }
    ).positionStrategy;

    const withPositionsSpy = jest.spyOn(strategy, "withPositions");

    const overlayRef = (directive as unknown as { overlayRef: OverlayRefStub }).overlayRef;
    const updatePositionSpy = jest.spyOn(overlayRef!, "updatePosition");

    fixture.componentInstance.currentPosition = "right-center";
    fixture.detectChanges();

    expect(withPositionsSpy).toHaveBeenCalled();
    expect(updatePositionSpy).toHaveBeenCalled();
  });

  it("updates internal _tooltipPosition signal from positionChanges", () => {
    const directive = getDirective();

    const getCurrentPos = (
      directive as unknown as {
        _tooltipPosition: () => TooltipPositionId;
      }
    )._tooltipPosition;

    const pair: ConnectionPositionPair = {
      originX: "center",
      originY: "top",
      overlayX: "center",
      overlayY: "bottom",
      offsetX: 0,
      offsetY: 0,
    };

    const changeEvent: ConnectedOverlayPositionChange & {
      connectionPair: ConnectionPositionPair & { id: TooltipPositionId };
    } = {
      connectionPair: { ...pair, id: "below-center" },
      scrollableViewProperties: {
        isOverlayClipped: false,
        isOriginClipped: false,
        isOriginOutsideView: false,
        isOverlayOutsideView: false,
      },
    };

    positionChanges$.next(changeEvent);

    expect(getCurrentPos()).toBe("below-center");
  });
});
