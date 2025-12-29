import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { NavigationModule } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import { SendFiltersNavComponent } from "../tools/send-v2/send-filters-nav.component";

import { DesktopLayoutComponent } from "./desktop-layout.component";

// Mock the child component to isolate DesktopLayoutComponent testing
@Component({
  selector: "app-send-filters-nav",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSendFiltersNavComponent {}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("DesktopLayoutComponent", () => {
  let component: DesktopLayoutComponent;
  let fixture: ComponentFixture<DesktopLayoutComponent>;

  const fakeGlobalStateProvider = new FakeGlobalStateProvider();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopLayoutComponent, RouterModule.forRoot([]), NavigationModule],
      providers: [
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
        {
          provide: GlobalStateProvider,
          useValue: fakeGlobalStateProvider,
        },
      ],
    })
      .overrideComponent(DesktopLayoutComponent, {
        remove: { imports: [SendFiltersNavComponent] },
        add: { imports: [MockSendFiltersNavComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DesktopLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("renders bit-layout component", () => {
    const compiled = fixture.nativeElement;
    const layoutElement = compiled.querySelector("bit-layout");

    expect(layoutElement).toBeTruthy();
  });

  it("supports content projection for side-nav", () => {
    const compiled = fixture.nativeElement;
    const ngContent = compiled.querySelectorAll("ng-content");

    expect(ngContent).toBeTruthy();
  });

  it("renders send filters navigation component", () => {
    const compiled = fixture.nativeElement;
    const sendFiltersNav = compiled.querySelector("app-send-filters-nav");

    expect(sendFiltersNav).toBeTruthy();
  });
});
