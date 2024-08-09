import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SelfHostedEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import {
  ButtonModule,
  BadgeModule,
  DialogService,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { SendListItemsContainerComponent } from "./send-list-items-container.component";

describe("SendListItemsContainerComponent", () => {
  let component: SendListItemsContainerComponent;
  let fixture: ComponentFixture<SendListItemsContainerComponent>;
  let environmentService: MockProxy<EnvironmentService>;
  let sendService: MockProxy<SendService>;

  const openSimpleDialog = jest.fn();
  const showToast = jest.fn();
  const copyToClipboard = jest.fn().mockImplementation(() => {});
  const deleteFn = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    sendService = mock<SendService>();

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        RouterTestingModule,
        JslibModule,
        ItemModule,
        ButtonModule,
        BadgeModule,
        IconButtonModule,
        SectionComponent,
        SectionHeaderComponent,
        TypographyModule,
      ],
      providers: [
        { provide: EnvironmentService, useValue: environmentService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: { copyToClipboard } },
        { provide: SendApiService, useValue: { delete: deleteFn } },
        { provide: ToastService, useValue: { showToast } },
        { provide: SendService, useValue: sendService },
      ],
    })
      .overrideProvider(DialogService, {
        useValue: {
          openSimpleDialog,
        },
      })
      .compileComponents();

    environmentService = mock<EnvironmentService>();
    Object.defineProperty(environmentService, "environment$", {
      configurable: true,
      get: () => of(new SelfHostedEnvironment({ webVault: "https://example.com" })),
    });

    deleteFn.mockClear();
    showToast.mockClear();
    openSimpleDialog.mockClear();
    copyToClipboard.mockClear();

    fixture = TestBed.createComponent(SendListItemsContainerComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should delete a send", async () => {
    openSimpleDialog.mockResolvedValue(true);
    const send = { id: "123", accessId: "abc", urlB64Key: "xyz" } as SendView;

    await component.deleteSend(send);

    expect(openSimpleDialog).toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledWith(send.id);
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: null,
      message: "deletedSend",
    });
  });

  it("should handle delete send cancellation", async () => {
    const send = { id: "123", accessId: "abc", urlB64Key: "xyz" } as SendView;
    openSimpleDialog.mockResolvedValue(false);

    await component.deleteSend(send);

    expect(openSimpleDialog).toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("should copy send link", async () => {
    const send = { id: "123", accessId: "abc", urlB64Key: "xyz" } as SendView;
    const link = "https://example.com/#/send/abc/xyz";

    await component.copySendLink(send);

    expect(copyToClipboard).toHaveBeenCalledWith(link);
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: null,
      message: "valueCopied",
    });
  });
});
