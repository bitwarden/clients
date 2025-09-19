import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { BannerComponent } from "./banner.component";

describe("BannerComponent", () => {
  let component: BannerComponent;
  let fixture: ComponentFixture<BannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              close: "Close",
              loading: "Loading",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create with alert", () => {
    expect(component.useAlertRole()).toBe(true);
    const el = fixture.nativeElement.children[0];
    expect(el.getAttribute("role")).toEqual("status");
    expect(el.getAttribute("aria-live")).toEqual("polite");
  });

  it("useAlertRole=false", () => {
    fixture.componentRef.setInput("useAlertRole", false);
    fixture.autoDetectChanges();

    expect(component.useAlertRole()).toBe(false);
    const el = fixture.nativeElement.children[0];
    expect(el.getAttribute("role")).toBeNull();
    expect(el.getAttribute("aria-live")).toBeNull();
  });
});
