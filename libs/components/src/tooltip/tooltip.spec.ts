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

import { TooltipComponent } from "./tooltip.component";
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

type TooltipRefStub = Pick<ComponentRefLike, "setInput">;
interface OverlayRefStub {
  attach: (portal: ComponentPortal<unknown>) => TooltipRefStub;
  updatePosition: () => void;
}

// Minimal interface to avoid importing full ComponentRef shape
interface ComponentRefLike {
  setInput: <K extends string, V>(key: K, value: V) => void;
}

describe("TooltipDirective", () => {
  let fixture: ComponentFixture<TooltipHostComponent>;
  let positionChanges$: Subject<ConnectedOverlayPositionChange>;
  let tooltipRefMock: TooltipRefStub;

  beforeEach(() => {
    positionChanges$ = new Subject<ConnectedOverlayPositionChange>();

    // Chainable strategy methods that return the same object
    const strategy: StrategyLike = {
      withFlexibleDimensions: jest.fn(() => strategy),
      withPush: jest.fn(() => strategy),
      withPositions: jest.fn(() => strategy),
      get positionChanges() {
        return positionChanges$.asObservable();
      },
    };

    // 2) Mock OverlayRef + attach() to return our tooltipRef stub
    tooltipRefMock = { setInput: jest.fn() };

    const overlayRefStub: OverlayRefStub = {
      attach: (_portal: ComponentPortal<unknown>) => tooltipRefMock,
      updatePosition: jest.fn(),
    };

    // 3) Provide an Overlay that returns our controllable strategy
    const overlayMock: OverlayLike = {
      position: () => ({
        flexibleConnectedTo: () => strategy,
      }),
      create: (_: OverlayConfig) => overlayRefStub,
      scrollStrategies: { reposition: () => ({}) },
    };

    TestBed.configureTestingModule({
      imports: [TooltipHostComponent],
      providers: [
        { provide: Overlay, useValue: overlayMock as unknown as Overlay },
        { provide: TooltipComponent, useValue: {} },
      ],
    });

    fixture = TestBed.createComponent(TooltipHostComponent);
    fixture.detectChanges();
  });

  function getDirective(): TooltipDirective {
    const hostDebugEl = fixture.debugElement.query(By.directive(TooltipDirective));
    return hostDebugEl.injector.get(TooltipDirective);
  }

  it("shows and hides the tooltip on hover", () => {
    const hostButton: HTMLButtonElement = fixture.debugElement.query(
      By.css("button"),
    ).nativeElement;
    const directive = getDirective();

    // Stub only the API we need, preserving types
    const tooltipRefMock: TooltipRefStub = {
      setInput: jest.fn(),
    };
    (directive as unknown as { tooltipRef: TooltipRefStub }).tooltipRef = tooltipRefMock;

    hostButton.dispatchEvent(new Event("mouseenter"));
    expect(tooltipRefMock.setInput).toHaveBeenCalledWith("isVisible", true);

    hostButton.dispatchEvent(new Event("mouseleave"));
    expect(tooltipRefMock.setInput).toHaveBeenCalledWith("isVisible", false);
  });

  it("updates strategy + forwards tooltipPosition when the input changes", () => {
    const directive = getDirective();

    const tooltipRefMock: TooltipRefStub = { setInput: jest.fn() };
    const overlayRefMock: OverlayRefStub = {
      attach: (_portal: ComponentPortal<unknown>) => tooltipRefMock,
      updatePosition: jest.fn(),
    };

    (directive as unknown as { tooltipRef: TooltipRefStub }).tooltipRef = tooltipRefMock;
    (directive as unknown as { overlayRef: OverlayRefStub }).overlayRef = overlayRefMock;

    // Spy on the existing strategy’s withPositions (keep original instance)
    const strategy = (
      directive as unknown as { positionStrategy: FlexibleConnectedPositionStrategy }
    ).positionStrategy;
    const withPositionsSpy = jest.spyOn(strategy, "withPositions");

    // Drive the change via host input
    fixture.componentInstance.currentPosition = "right-center";
    fixture.detectChanges();

    expect(withPositionsSpy).toHaveBeenCalled();
    expect(overlayRefMock.updatePosition).toHaveBeenCalled();
    expect(tooltipRefMock.setInput).toHaveBeenCalledWith("tooltipPosition", "right-center");
  });

  it("forwards active connectionPair id from positionChanges to the tooltip", () => {
    const directive = getDirective();

    const tooltipRefMock: TooltipRefStub = { setInput: jest.fn() };
    (directive as unknown as { tooltipRef: TooltipRefStub }).tooltipRef = tooltipRefMock;

    // Use the subject created in beforeEach
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

    // Emit on the subject the directive subscribed to
    positionChanges$.next(changeEvent);

    expect(tooltipRefMock.setInput).toHaveBeenCalledWith("tooltipPosition", "below-center");
  });
});
