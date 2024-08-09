import { CommonModule, Location } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SelfHostedEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { ButtonModule, IconModule, ToastService } from "@bitwarden/components";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

import { SendCreatedComponent } from "./send-created.component";

describe("SendCreatedComponent", () => {
  let component: SendCreatedComponent;
  let fixture: ComponentFixture<SendCreatedComponent>;
  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let sendService: MockProxy<SendService>;
  let toastService: MockProxy<ToastService>;
  let location: MockProxy<Location>;
  let activatedRoute: MockProxy<ActivatedRoute>;
  let environmentService: MockProxy<EnvironmentService>;

  const sendId = "test-send-id";
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + 7);
  const sendView: SendView = {
    id: sendId,
    deletionDate,
    accessId: "abc",
    urlB64Key: "123",
  } as SendView;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    platformUtilsService = mock<PlatformUtilsService>();
    sendService = mock<SendService>();
    toastService = mock<ToastService>();
    location = mock<Location>();
    activatedRoute = mock<ActivatedRoute>();
    environmentService = mock<EnvironmentService>();
    Object.defineProperty(environmentService, "environment$", {
      configurable: true,
      get: () => of(new SelfHostedEnvironment({ webVault: "https://example.com" })),
    });

    activatedRoute.snapshot = {
      queryParamMap: {
        get: jest.fn().mockReturnValue(sendId),
      },
    } as any;

    sendService.sendViews$ = of([sendView]);

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
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SendService, useValue: sendService },
        { provide: ToastService, useValue: toastService },
        { provide: Location, useValue: location },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: EnvironmentService, useValue: environmentService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SendCreatedComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it("should initialize send and daysAvailable", () => {
    fixture.detectChanges();
    expect(component["send"]).toBe(sendView);
    expect(component["daysAvailable"]).toBe(7);
  });

  it("should navigate back on close", () => {
    fixture.detectChanges();
    component.close();
    expect(location.back).toHaveBeenCalled();
  });

  describe("getDaysAvailable", () => {
    it("returns the correct number of days", () => {
      fixture.detectChanges();
      expect(component.getDaysAvailable(sendView)).toBe(7);
    });
  });

  describe("copyLink", () => {
    it("should copy link and show toast", async () => {
      fixture.detectChanges();
      const link = "https://example.com/#/send/abc/123";

      await component.copyLink();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(link);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: i18nService.t("sendLinkCopied"),
      });
    });
  });
});
