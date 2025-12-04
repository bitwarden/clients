import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { NavigationModule, StorybookGlobalStateProvider } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import { DesktopLayoutComponent } from "./desktop-layout.component";

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
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }).compileComponents();

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
});
