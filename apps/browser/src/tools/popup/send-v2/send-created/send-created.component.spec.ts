import { CommonModule, Location } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SelfHostedEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { ButtonModule, I18nMockService, IconModule, ToastService } from "@bitwarden/components";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../../platform/popup/view-cache/popup-router-cache.service";

import { SendCreatedComponent } from "./send-created.component";

describe("SendCreatedComponent", () => {
  let component: SendCreatedComponent;
  let fixture: ComponentFixture<SendCreatedComponent>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let sendService: MockProxy<SendService>;
  let toastService: MockProxy<ToastService>;
  let location: MockProxy<Location>;
  let activatedRoute: MockProxy<ActivatedRoute>;
  let environmentService: MockProxy<EnvironmentService>;
  let router: MockProxy<Router>;

  const sendId = "test-send-id";
  let sendView: SendView;
  let sendViewsSubject: BehaviorSubject<SendView[]>;

  beforeEach(async () => {
    platformUtilsService = mock<PlatformUtilsService>();
    sendService = mock<SendService>();
    toastService = mock<ToastService>();
    location = mock<Location>();
    activatedRoute = mock<ActivatedRoute>();
    environmentService = mock<EnvironmentService>();
    router = mock<Router>();

    sendView = {
      id: sendId,
      deletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      type: SendType.Text,
      accessId: "abc",
      urlB64Key: "123",
    } as SendView;

    sendViewsSubject = new BehaviorSubject<SendView[]>([sendView]);
    sendService.sendViews$ = sendViewsSubject.asObservable();

    Object.defineProperty(environmentService, "environment$", {
      configurable: true,
      get: () => of(new SelfHostedEnvironment({ webVault: "https://example.com" })),
    });

    activatedRoute.snapshot = {
      queryParamMap: {
        get: jest.fn().mockReturnValue(sendId),
      },
    } as any;

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        RouterTestingModule,
        JslibModule,
        ButtonModule,
        IconModule,
        PopOutComponent,
        PopupHeaderComponent,
        PopupPageComponent,
        RouterLink,
        PopupFooterComponent,
        SendCreatedComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              back: "back",
              loading: "loading",
              copyLink: "copyLink",
              close: "close",
              createdSend: "createdSend",
              createdSendSuccessfully: "createdSendSuccessfully",
              popOutNewWindow: "popOutNewWindow",
              sendExpiresInHours: (hours) => `sendExpiresInHours ${hours}`,
              sendExpiresInHoursSingle: "sendExpiresInHoursSingle",
              sendExpiresInDays: (days) => `sendExpiresInDays ${days}`,
              sendExpiresInDaysSingle: "sendExpiresInDaysSingle",
              sendLinkCopied: "sendLinkCopied",
            });
          },
        },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SendService, useValue: sendService },
        { provide: ToastService, useValue: toastService },
        { provide: Location, useValue: location },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendCreatedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize send, daysAvailable, and hoursAvailable", () => {
    expect(component["send"]).toBe(sendView);
    expect(component["daysAvailable"]).toBe(7);
    expect(component["hoursAvailable"]).toBe(168);
  });

  it("should navigate back to the edit send form on close", async () => {
    await component.goToEditSend();
    expect(router.navigate).toHaveBeenCalledWith(["/edit-send"], {
      queryParams: { sendId: "test-send-id", type: SendType.Text },
    });
  });

  describe("getHoursAvailable", () => {
    it("returns the correct number of hours", () => {
      sendViewsSubject.next([sendView]);
      fixture.detectChanges();

      expect(component.getHoursAvailable(sendView)).toBeCloseTo(168, 0);
    });
  });

  describe("formatExpirationDate", () => {
    it("returns days plural if expiry is more than 24 hours", () => {
      sendView.deletionDate = new Date(Date.now() + 168 * 60 * 60 * 1000);
      sendViewsSubject.next([sendView]);
      fixture.detectChanges();

      expect(component.formatExpirationDate()).toBe("sendExpiresInDays 7");
    });

    it("returns days singular if expiry is 24 hours", () => {
      sendView.deletionDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      sendViewsSubject.next([sendView]);
      fixture.detectChanges();

      expect(component.formatExpirationDate()).toBe("sendExpiresInDaysSingle");
    });

    it("returns hours plural if expiry is more than 1 hour but less than 24", () => {
      sendView.deletionDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      sendViewsSubject.next([sendView]);
      fixture.detectChanges();

      expect(component.formatExpirationDate()).toBe("sendExpiresInHours 2");
    });

    it("returns hours singular if expiry is in 1 hour", () => {
      sendView.deletionDate = new Date(Date.now() + 1 * 60 * 60 * 1000);
      sendViewsSubject.next([sendView]);
      fixture.detectChanges();

      expect(component.formatExpirationDate()).toBe("sendExpiresInHoursSingle");
    });
  });

  describe("copyLink", () => {
    it("should copy link and show toast", async () => {
      const link = "https://example.com/#/send/abc/123";

      await component.copyLink();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(link);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: "sendLinkCopied",
      });
    });
  });
});
