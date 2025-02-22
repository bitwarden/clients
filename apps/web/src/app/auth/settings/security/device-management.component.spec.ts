import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { of, Subject } from "rxjs";

import { AuthRequestApiService } from "@bitwarden/auth/common";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { DialogService, ToastService, TableModule, PopoverModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { VaultBannersService } from "../../../vault/individual-vault/vault-banners/services/vault-banners.service";

import { DeviceManagementComponent } from "./device-management.component";

class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.ResizeObserver = MockResizeObserver;

interface Message {
  command: string;
  notificationId?: string;
}

describe("DeviceManagementComponent", () => {
  let fixture: ComponentFixture<DeviceManagementComponent>;
  let messageSubject: Subject<Message>;
  let mockDevices: DeviceView[];
  let vaultBannersService: VaultBannersService;

  const mockDeviceResponse = {
    id: "test-id",
    requestDeviceType: "test-type",
    requestDeviceTypeValue: DeviceType.Android,
    requestDeviceIdentifier: "test-identifier",
    requestIpAddress: "127.0.0.1",
    creationDate: new Date().toISOString(),
    responseDate: null,
    key: "test-key",
    masterPasswordHash: null,
    publicKey: "test-public-key",
    requestApproved: false,
    origin: "test-origin",
  };

  beforeEach(async () => {
    messageSubject = new Subject<Message>();
    mockDevices = [];

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        SharedModule,
        TableModule,
        PopoverModule,
        DeviceManagementComponent,
      ],
      providers: [
        {
          provide: DevicesServiceAbstraction,
          useValue: {
            getDevices$: jest.fn().mockReturnValue(mockDevices),
            getCurrentDevice$: jest.fn().mockReturnValue(of(null)),
            getDeviceByIdentifier$: jest.fn().mockReturnValue(of(null)),
            updateTrustedDeviceKeys: jest.fn(),
          },
        },
        {
          provide: AuthRequestApiService,
          useValue: {
            getAuthRequest: jest.fn().mockResolvedValue(mockDeviceResponse),
          },
        },
        {
          provide: MessageListener,
          useValue: {
            allMessages$: messageSubject.asObservable(),
          },
        },
        {
          provide: DialogService,
          useValue: {
            openSimpleDialog: jest.fn(),
          },
        },
        {
          provide: ToastService,
          useValue: {
            success: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: VaultBannersService,
          useValue: {
            shouldShowPendingAuthRequestBanner: jest.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: jest.fn((key: string) => key),
          },
        },
        {
          provide: ValidationService,
          useValue: {
            showError: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceManagementComponent);

    vaultBannersService = TestBed.inject(VaultBannersService);
  });

  describe("message listener", () => {
    beforeEach(() => {
      jest.spyOn(vaultBannersService, "shouldShowPendingAuthRequestBanner").mockResolvedValue(true);
    });

    it("ignores other message types", async () => {
      const initialDataLength = (fixture.componentInstance as any).dataSource.data.length;
      const message: Message = { command: "other", notificationId: "test-id" };
      messageSubject.next(message);
      await fixture.whenStable();

      expect((fixture.componentInstance as any).dataSource.data.length).toBe(initialDataLength);
    });

    it("adds device to table when auth request message received", async () => {
      const initialDataLength = (fixture.componentInstance as any).dataSource.data.length;
      const message: Message = {
        command: "openLoginApproval",
        notificationId: "test-id",
      };

      messageSubject.next(message);
      fixture.detectChanges();
      await fixture.whenStable();

      const dataSource = (fixture.componentInstance as any).dataSource;
      expect(dataSource.data.length).toBe(initialDataLength + 1);

      const addedDevice = dataSource.data[0];
      expect(addedDevice).toEqual({
        id: "",
        type: mockDeviceResponse.requestDeviceTypeValue,
        displayName: expect.any(String),
        loginStatus: "requestPending",
        firstLogin: expect.any(Date),
        trusted: false,
        devicePendingAuthRequest: {
          id: mockDeviceResponse.id,
          creationDate: mockDeviceResponse.creationDate,
        },
        hasPendingAuthRequest: true,
        identifier: mockDeviceResponse.requestDeviceIdentifier,
      });
    });

    it("stops listening when component is destroyed", async () => {
      fixture.destroy();
      const message: Message = {
        command: "openLoginApproval",
        notificationId: "test-id",
      };
      messageSubject.next(message);
      expect((fixture.componentInstance as any).dataSource.data.length).toBe(0);
    });
  });
});
