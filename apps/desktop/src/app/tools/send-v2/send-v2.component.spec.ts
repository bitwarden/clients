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
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
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

  beforeEach(async () => {
    sendService = mock<SendService>();
    accountService = mock<AccountService>();
    policyService = mock<PolicyService>();
    changeDetectorRef = mock<ChangeDetectorRef>();
    sendFormConfigService = mock<DefaultSendFormConfigService>();
    dialogService = mock<DialogService>();

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
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: SearchService, useValue: mockSearchService },
        { provide: PolicyService, useValue: policyService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
        { provide: DialogService, useValue: dialogService },
        { provide: DefaultSendFormConfigService, useValue: sendFormConfigService },
        { provide: ToastService, useValue: mock<ToastService>() },
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

  it("initializes with correct default action", () => {
    expect(component["action"]()).toBe("");
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

    it("calls closeEditPanel when dialog returns result", async () => {
      const mockConfig = { mode: "add" } as SendFormConfig;
      const mockDialogRef = { closed: of(true) };

      sendFormConfigService.buildConfig.mockResolvedValue(mockConfig);
      jest.spyOn(SendAddEditDialogComponent, "openDrawer").mockReturnValue(mockDialogRef as any);
      jest.spyOn(component as any, "closeEditPanel");

      await component["addSend"](SendType.Text);

      expect(component["closeEditPanel"]).toHaveBeenCalled();
    });

    it("does not call closeEditPanel when dialog is cancelled", async () => {
      const mockConfig = { mode: "add" } as SendFormConfig;
      const mockDialogRef = { closed: of(undefined) };

      sendFormConfigService.buildConfig.mockResolvedValue(mockConfig);
      jest.spyOn(SendAddEditDialogComponent, "openDrawer").mockReturnValue(mockDialogRef as any);
      jest.spyOn(component as any, "closeEditPanel");

      await component["addSend"](SendType.Text);

      expect(component["closeEditPanel"]).not.toHaveBeenCalled();
    });
  });

  describe("closeEditPanel", () => {
    it("resets action to None", () => {
      component["action"].set("edit");
      component["sendId"].set("test-id");

      component["closeEditPanel"]();

      expect(component["action"]()).toBe("");
      expect(component["sendId"]()).toBeNull();
    });
  });

  describe("savedSend", () => {
    it("selects the saved send", async () => {
      jest.spyOn(component as any, "selectSend").mockResolvedValue(undefined);

      const mockSend = new SendView();
      mockSend.id = "saved-send-id";

      await component["savedSend"](mockSend);

      expect(component["selectSend"]).toHaveBeenCalledWith("saved-send-id");
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

    it("calls closeEditPanel when dialog returns result", async () => {
      const mockConfig = { mode: "edit" } as SendFormConfig;
      const mockDialogRef = { closed: of(true) };

      sendFormConfigService.buildConfig.mockResolvedValue(mockConfig);
      jest.spyOn(SendAddEditDialogComponent, "openDrawer").mockReturnValue(mockDialogRef as any);
      jest.spyOn(component as any, "closeEditPanel");

      await component["selectSend"]("test-send-id");

      expect(component["closeEditPanel"]).toHaveBeenCalled();
    });

    it("does not call closeEditPanel when dialog is cancelled", async () => {
      const mockConfig = { mode: "edit" } as SendFormConfig;
      const mockDialogRef = { closed: of(undefined) };

      sendFormConfigService.buildConfig.mockResolvedValue(mockConfig);
      jest.spyOn(SendAddEditDialogComponent, "openDrawer").mockReturnValue(mockDialogRef as any);
      jest.spyOn(component as any, "closeEditPanel");

      await component["selectSend"]("test-send-id");

      expect(component["closeEditPanel"]).not.toHaveBeenCalled();
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
});
