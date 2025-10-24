import {
  ConnectedOverlayPositionChange,
  ConnectionPositionPair,
  OverlayConfig,
  Overlay,
} from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Observable, Subject } from "rxjs";

import { TooltipDirective } from "./tooltip.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  imports: [TooltipDirective],
  template: ` <button [bitTooltip]="tooltipText" type="button">Hover or focus me</button> `,
})
class TooltipHostComponent {
  tooltipText = "Hello Tooltip";
}

/** Minimal strategy shape the directive expects */
interface StrategyLike {
  withFlexibleDimensions: (flex: boolean) => StrategyLike;
  withPush: (push: boolean) => StrategyLike;
  withPositions: (positions: ReadonlyArray<ConnectionPositionPair>) => StrategyLike;
  readonly positionChanges: Observable<ConnectedOverlayPositionChange>;
}

/** Minimal Overlay service shape */
interface OverlayLike {
  position: () => { flexibleConnectedTo: (_: unknown) => StrategyLike };
  create: (_: OverlayConfig) => OverlayRefStub;
  scrollStrategies: { reposition: () => unknown };
}

interface OverlayRefStub {
  attach: (portal: ComponentPortal<unknown>) => unknown;
  updatePosition: () => void;
}

describe("TooltipDirective (visibility only)", () => {
  let fixture: ComponentFixture<TooltipHostComponent>;

  beforeEach(() => {
    const positionChanges$ = new Subject<ConnectedOverlayPositionChange>();

    const strategy: StrategyLike = {
      withFlexibleDimensions: jest.fn(() => strategy),
      withPush: jest.fn(() => strategy),
      withPositions: jest.fn(() => strategy),
      get positionChanges() {
        return positionChanges$.asObservable();
      },
    };

    const overlayRefStub: OverlayRefStub = {
      attach: jest.fn(() => ({
        changeDetectorRef: { detectChanges: jest.fn() },
        location: {
          nativeElement: {
            querySelector: jest.fn().mockReturnValue({ id: "tip-123" }),
          },
        },
      })),
      updatePosition: jest.fn(),
    };

    const overlayMock: OverlayLike = {
      position: () => ({ flexibleConnectedTo: () => strategy }),
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
    const hostDE = fixture.debugElement.query(By.directive(TooltipDirective));
    return hostDE.injector.get(TooltipDirective);
  }

  it("sets isVisible to true on mouseenter", () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css("button")).nativeElement;
    const directive = getDirective();

    const isVisible = (directive as unknown as { isVisible: () => boolean }).isVisible;

    button.dispatchEvent(new Event("mouseenter"));
    expect(isVisible()).toBe(true);
  });

  it("sets isVisible to true on focus", () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css("button")).nativeElement;
    const directive = getDirective();

    const isVisible = (directive as unknown as { isVisible: () => boolean }).isVisible;

    button.dispatchEvent(new Event("focus"));
    expect(isVisible()).toBe(true);
  });
});
