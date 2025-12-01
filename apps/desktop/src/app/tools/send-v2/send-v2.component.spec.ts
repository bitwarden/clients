import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { SendItemsService, SendListFiltersService } from "@bitwarden/send-ui";

import { AddEditComponent } from "../send/add-edit.component";

import { SendV2Component } from "./send-v2.component";

describe("SendV2Component", () => {
  let component: SendV2Component;
  let fixture: ComponentFixture<SendV2Component>;
  let sendItemsService: MockProxy<SendItemsService>;
  let sendListFiltersService: MockProxy<SendListFiltersService>;

  const mockSends: SendView[] = [
    {
      id: "send-1",
      name: "Test Send 1",
      type: SendType.Text,
      disabled: false,
      deletionDate: new Date("2024-12-31"),
    } as SendView,
    {
      id: "send-2",
      name: "Test Send 2",
      type: SendType.File,
      disabled: false,
      deletionDate: new Date("2024-12-25"),
    } as SendView,
  ];

  beforeEach(async () => {
    sendItemsService = mock<SendItemsService>();
    sendListFiltersService = mock<SendListFiltersService>();

    sendItemsService.filteredAndSortedSends$ = new BehaviorSubject<SendView[]>(mockSends);
    sendItemsService.loading$ = new BehaviorSubject<boolean>(false);

    await TestBed.configureTestingModule({
      imports: [SendV2Component],
      providers: [
        { provide: SendItemsService, useValue: sendItemsService },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    })
      .overrideComponent(SendV2Component, {
        remove: { imports: [AddEditComponent] },
        add: { imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SendV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("initializes with loaded sends", () => {
    expect(component["filteredSends"]()).toEqual(mockSends);
    expect(component["loaded"]()).toBe(true);
  });

  it("initializes with no action and no sendId", () => {
    expect(component["action"]()).toBeNull();
    expect(component["sendId"]()).toBeNull();
  });

  describe("selectSend", () => {
    it("sets action to edit and updates sendId", async () => {
      await component["selectSend"]("send-1");

      expect(component["action"]()).toBe("edit");
      expect(component["sendId"]()).toBe("send-1");
    });

    it("does not update if same send is already selected in edit mode", async () => {
      component["action"].set("edit");
      component["sendId"].set("send-1");

      const initialAction = component["action"]();
      const initialSendId = component["sendId"]();

      await component["selectSend"]("send-1");

      expect(component["action"]()).toBe(initialAction);
      expect(component["sendId"]()).toBe(initialSendId);
    });

    it("calls refresh on AddEditComponent if available", async () => {
      const mockAddEditComponent = {
        sendId: "",
        refresh: jest.fn().mockResolvedValue(undefined),
      } as unknown as AddEditComponent;

      // Mock the viewChild signal to return the mock component
      Object.defineProperty(component, "addEditComponent", {
        value: () => mockAddEditComponent,
        writable: false,
      });

      await component["selectSend"]("send-1");

      expect(mockAddEditComponent.sendId).toBe("send-1");
      expect(mockAddEditComponent.refresh).toHaveBeenCalled();
    });
  });

  describe("addSend", () => {
    it("sets action to add and clears sendId", () => {
      component["sendId"].set("send-1");

      component["addSend"]();

      expect(component["action"]()).toBe("add");
      expect(component["sendId"]()).toBeNull();
    });

    it("sets pendingAddType to null when no type is provided", () => {
      component["addSend"]();

      expect(component["pendingAddType"]()).toBeNull();
    });

    it("sets pendingAddType when type is provided", () => {
      component["addSend"](SendType.Text);

      expect(component["pendingAddType"]()).toBe(SendType.Text);
    });

    it("calls initializeAddEdit with type when AddEditComponent is available", () => {
      const mockAddEditComponent = {
        type: SendType.File,
        resetAndLoad: jest.fn().mockResolvedValue(undefined),
      } as unknown as AddEditComponent;

      Object.defineProperty(component, "addEditComponent", {
        value: () => mockAddEditComponent,
        writable: false,
      });

      const initializeSpy = jest.spyOn(component as any, "initializeAddEdit");

      component["addSend"](SendType.Text);

      expect(initializeSpy).toHaveBeenCalledWith(SendType.Text);
    });

    it("does not call initializeAddEdit when AddEditComponent is not available", () => {
      Object.defineProperty(component, "addEditComponent", {
        value: () => null,
        writable: false,
      });

      const initializeSpy = jest.spyOn(component as any, "initializeAddEdit");

      component["addSend"](SendType.Text);

      expect(initializeSpy).not.toHaveBeenCalled();
    });
  });

  describe("savedSend", () => {
    it("calls selectSend with the saved send id", async () => {
      const selectSendSpy = jest.spyOn(component as any, "selectSend");
      const savedSend = mockSends[0];

      await component["savedSend"](savedSend);

      expect(selectSendSpy).toHaveBeenCalledWith(savedSend.id);
    });

    it("clears pendingAddType", async () => {
      component["pendingAddType"].set(SendType.Text);
      const savedSend = mockSends[0];

      await component["savedSend"](savedSend);

      expect(component["pendingAddType"]()).toBeNull();
    });
  });

  describe("cancel", () => {
    it("clears action and sendId", () => {
      component["action"].set("edit");
      component["sendId"].set("send-1");

      component["cancel"](mockSends[0]);

      expect(component["action"]()).toBeNull();
      expect(component["sendId"]()).toBeNull();
    });

    it("clears pendingAddType", () => {
      component["pendingAddType"].set(SendType.File);
      component["action"].set("add");

      component["cancel"](mockSends[0]);

      expect(component["pendingAddType"]()).toBeNull();
    });
  });

  describe("deletedSend", () => {
    it("clears action and sendId", async () => {
      component["action"].set("edit");
      component["sendId"].set("send-1");

      await component["deletedSend"](mockSends[0]);

      expect(component["action"]()).toBeNull();
      expect(component["sendId"]()).toBeNull();
    });

    it("clears pendingAddType", async () => {
      component["pendingAddType"].set(SendType.Text);
      component["action"].set("add");

      await component["deletedSend"](mockSends[0]);

      expect(component["pendingAddType"]()).toBeNull();
    });
  });

  describe("selectedSendType", () => {
    it("returns null when no sendId is set and not in add mode", () => {
      component["sendId"].set(null);
      component["action"].set(null);

      expect(component["selectedSendType"]()).toBeNull();
    });

    it("returns pendingAddType when in add mode", () => {
      component["action"].set("add");
      component["pendingAddType"].set(SendType.File);

      expect(component["selectedSendType"]()).toBe(SendType.File);
    });

    it("returns null when in add mode with no pending type", () => {
      component["action"].set("add");
      component["pendingAddType"].set(null);

      expect(component["selectedSendType"]()).toBeNull();
    });

    it("returns the type of the selected send in edit mode", () => {
      component["action"].set("edit");
      component["sendId"].set("send-1");

      expect(component["selectedSendType"]()).toBe(SendType.Text);
    });

    it("returns null when send is not found in edit mode", () => {
      component["action"].set("edit");
      component["sendId"].set("non-existent-id");

      expect(component["selectedSendType"]()).toBeNull();
    });
  });

  describe("loading state", () => {
    it("shows loaded as true when loading is false", () => {
      (sendItemsService.loading$ as BehaviorSubject<boolean>).next(false);

      expect(component["loaded"]()).toBe(true);
    });

    it("shows loaded as false when loading is true", () => {
      (sendItemsService.loading$ as BehaviorSubject<boolean>).next(true);

      expect(component["loaded"]()).toBe(false);
    });
  });

  describe("ngAfterViewInit", () => {
    it("calls initializeAddEdit when action is add and pendingAddType is set", () => {
      component["action"].set("add");
      component["pendingAddType"].set(SendType.Text);

      const initializeSpy = jest.spyOn(component as any, "initializeAddEdit");

      component.ngAfterViewInit();

      expect(initializeSpy).toHaveBeenCalledWith(SendType.Text);
      expect(component["pendingAddType"]()).toBeNull();
    });

    it("does not call initializeAddEdit when action is not add", () => {
      component["action"].set("edit");
      component["pendingAddType"].set(SendType.Text);

      const initializeSpy = jest.spyOn(component as any, "initializeAddEdit");

      component.ngAfterViewInit();

      expect(initializeSpy).not.toHaveBeenCalled();
    });

    it("does not call initializeAddEdit when pendingAddType is null", () => {
      component["action"].set("add");
      component["pendingAddType"].set(null);

      const initializeSpy = jest.spyOn(component as any, "initializeAddEdit");

      component.ngAfterViewInit();

      expect(initializeSpy).not.toHaveBeenCalled();
    });
  });

  describe("initializeAddEdit", () => {
    it("sets type on component and calls resetAndLoad", async () => {
      const mockAddEditComponent = {
        type: null,
        resetAndLoad: jest.fn().mockResolvedValue(undefined),
      } as unknown as AddEditComponent;

      Object.defineProperty(component, "addEditComponent", {
        value: () => mockAddEditComponent,
        writable: false,
      });

      await component["initializeAddEdit"](SendType.File);

      expect(mockAddEditComponent.type).toBe(SendType.File);
      expect(mockAddEditComponent.resetAndLoad).toHaveBeenCalled();
    });

    it("does not set type when type is null", async () => {
      const mockAddEditComponent = {
        type: SendType.Text,
        resetAndLoad: jest.fn().mockResolvedValue(undefined),
      } as unknown as AddEditComponent;

      Object.defineProperty(component, "addEditComponent", {
        value: () => mockAddEditComponent,
        writable: false,
      });

      await component["initializeAddEdit"](null);

      expect(mockAddEditComponent.type).toBe(SendType.Text); // Unchanged
      expect(mockAddEditComponent.resetAndLoad).toHaveBeenCalled();
    });

    it("does nothing when component is not available", async () => {
      Object.defineProperty(component, "addEditComponent", {
        value: () => null,
        writable: false,
      });

      await expect(component["initializeAddEdit"](SendType.Text)).resolves.not.toThrow();
    });
  });
});
