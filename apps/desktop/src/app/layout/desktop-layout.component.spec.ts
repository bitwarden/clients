import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { NavigationModule } from "@bitwarden/components";
import { SendListFiltersService } from "@bitwarden/send-ui";

import { SendFiltersNavComponent } from "../tools/send-v2/send-filters-nav.component";

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
    const filterFormValueSubject = new BehaviorSubject<{ sendType: SendType | null }>({
      sendType: null,
    });

    const sendListFiltersService = mock<SendListFiltersService>();
    sendListFiltersService.filterForm = {
      value: { sendType: null },
      valueChanges: filterFormValueSubject.asObservable(),
      patchValue: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [
        DesktopLayoutComponent,
        SendFiltersNavComponent,
        RouterModule.forRoot([]),
        NavigationModule,
      ],
      providers: [
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
        {
          provide: SendListFiltersService,
          useValue: sendListFiltersService,
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

  it("renders send filters navigation component", () => {
    const compiled = fixture.nativeElement;
    const sendFiltersNav = compiled.querySelector("app-send-filters-nav");

    expect(sendFiltersNav).toBeTruthy();
  });
});
