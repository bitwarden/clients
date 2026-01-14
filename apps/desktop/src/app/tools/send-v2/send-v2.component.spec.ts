// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  SendItemsService,
  SendListFiltersService,
  DefaultSendFormConfigService,
  SendAddEditDialogComponent,
  SendFormConfig,
} from "@bitwarden/send-ui";

import { SendV2Component } from "./send-v2.component";

describe("SendV2Component", () => {
  let component: SendV2Component;
  let fixture: ComponentFixture<SendV2Component>;
  let sendService: MockProxy<SendService>;
  let accountService: MockProxy<AccountService>;
  let policyService: MockProxy<PolicyService>;
  let sendItemsService: MockProxy<SendItemsService>;
  let sendListFiltersService: MockProxy<SendListFiltersService>;
  let changeDetectorRef: MockProxy<ChangeDetectorRef>;
  let sendFormConfigService: MockProxy<DefaultSendFormConfigService>;
  let dialogService: MockProxy<DialogService>;
  let environmentService: MockProxy<EnvironmentService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let sendApiService: MockProxy<SendApiService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    sendService = mock<SendService>();
    accountService = mock<AccountService>();
    policyService = mock<PolicyService>();
    changeDetectorRef = mock<ChangeDetectorRef>();
    sendFormConfigService = mock<DefaultSendFormConfigService>();
    dialogService = mock<DialogService>();
    environmentService = mock<EnvironmentService>();
    platformUtilsService = mock<PlatformUtilsService>();
    sendApiService = mock<SendApiService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();

    // Setup environmentService mock
    environmentService.getEnvironment.mockResolvedValue({
      getSendUrl: () => "https://send.bitwarden.com/#/",
    } as any);

    // Setup i18nService mock
    i18nService.t.mockImplementation((key: string) => key);

    // Mock SendItemsService with all required observables
    sendItemsService = mock<SendItemsService>();
    sendItemsService.filteredAndSortedSends$ = of([]);
    sendItemsService.loading$ = of(false);
    sendItemsService.emptyList$ = of(false);
    sendItemsService.noFilteredResults$ = of(false);
    sendItemsService.latestSearchText$ = of("");

    // Mock SendListFiltersService
    sendListFiltersService = mock<SendListFiltersService>();

    // Mock sendViews$ observable
    sendService.sendViews$ = of([]);

    // Mock activeAccount$ observable
    accountService.activeAccount$ = of({ id: "test-user-id" } as any);
    policyService.policyAppliesToUser$ = jest.fn().mockReturnValue(of(false));

    // Mock SearchService methods needed by base component
    const mockSearchService = mock<SearchService>();
    mockSearchService.isSearchable.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [SendV2Component],
      providers: [
        provideNoopAnimations(),
        { provide: SendService, useValue: sendService },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: PolicyService, useValue: policyService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: SendApiService, useValue: sendApiService },
        { provide: DialogService, useValue: dialogService },
        { provide: DefaultSendFormConfigService, useValue: sendFormConfigService },
        { provide: ToastService, useValue: toastService },
        { provide: AccountService, useValue: accountService },
        { provide: SendItemsService, useValue: sendItemsService },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: ChangeDetectorRef, useValue: changeDetectorRef },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({}),
          },
        },
      ],
    })
      .overrideComponent(SendV2Component, {
        set: {
          providers: [
            { provide: DefaultSendFormConfigService, useValue: sendFormConfigService },
            { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SendV2Component);
    component = fixture.componentInstance;
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  describe("addSend", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("opens dialog with correct config for Text send", async () => {
      const mockConfig = { mode: "add", sendType: SendType.Text } as SendFormConfig;
      const mockDialogRef = { closed: of(true) };

      sendFormConfigService.buildConfig.mockResolvedValue(mockConfig);
      const openDrawerSpy = jest
        .spyOn(SendAddEditDialogComponent, "openDrawer")
        .mockReturnValue(mockDialogRef as any);

      await component["addSend"](SendType.Text);

      expect(sendFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        SendType.Text,
      );
      expect(openDrawerSpy).toHaveBeenCalled();
      expect(openDrawerSpy.mock.calls[0][1]).toEqual({
        formConfig: mockConfig,
      });
    });

    it("opens dialog with correct config for File send", async () => {
      const mockConfig = { mode: "add", sendType: SendType.File } as SendFormConfig;
      const mockDialogRef = { closed: of(true) };

      sendFormConfigService.buildConfig.mockResolvedValue(mockConfig);
      const openDrawerSpy = jest
        .spyOn(SendAddEditDialogComponent, "openDrawer")
        .mockReturnValue(mockDialogRef as any);

      await component["addSend"](SendType.File);

      expect(sendFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        SendType.File,
      );
      expect(openDrawerSpy).toHaveBeenCalled();
      expect(openDrawerSpy.mock.calls[0][1]).toEqual({
        formConfig: mockConfig,
      });
    });
  });

  describe("selectSend", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("opens dialog with correct config for editing send", async () => {
      const mockConfig = { mode: "edit", sendId: "test-send-id" } as SendFormConfig;
      const mockDialogRef = { closed: of(true) };

      sendFormConfigService.buildConfig.mockResolvedValue(mockConfig);
      const openDrawerSpy = jest
        .spyOn(SendAddEditDialogComponent, "openDrawer")
        .mockReturnValue(mockDialogRef as any);

      await component["selectSend"]("test-send-id");

      expect(sendFormConfigService.buildConfig).toHaveBeenCalledWith("edit", "test-send-id");
      expect(openDrawerSpy).toHaveBeenCalled();
      expect(openDrawerSpy.mock.calls[0][1]).toEqual({
        formConfig: mockConfig,
      });
    });
  });

  describe("onEditSend", () => {
    it("selects the send for editing", async () => {
      jest.spyOn(component as any, "selectSend").mockResolvedValue(undefined);
      const mockSend = new SendView();
      mockSend.id = "edit-send-id";

      await component["onEditSend"](mockSend);

      expect(component["selectSend"]).toHaveBeenCalledWith("edit-send-id");
    });
  });

  describe("onCopySend", () => {
    it("copies send link to clipboard and shows success toast", async () => {
      const mockSend = {
        accessId: "test-access-id",
        urlB64Key: "test-key",
      } as SendView;

      await component["onCopySend"](mockSend);

      expect(environmentService.getEnvironment).toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "https://send.bitwarden.com/#/test-access-id/test-key",
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: expect.any(String),
      });
    });
  });
});
