import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";

import { ChangeKdfModule } from "../../../key-management/change-kdf/change-kdf.module";
import { KeyRotationComponent } from "../../../key-management/key-rotation/key-rotation.component";
import { UserKeyRotationService } from "../../../key-management/key-rotation/user-key-rotation.service";

import { SecurityKeysComponent } from "./security-keys.component";

@Component({
  selector: "app-user-key-rotation",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockKeyRotationComponent {}

@Component({
  selector: "app-change-kdf",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockChangeKdfComponent {}

describe("SecurityKeysComponent", () => {
  let fixture: ComponentFixture<SecurityKeysComponent>;

  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let userKeyRotationService: MockProxy<UserKeyRotationService>;

  const mockUserId = newGuid() as UserId;

  beforeEach(async () => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    keyConnectorService = mock<KeyConnectorService>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    userKeyRotationService = mock<UserKeyRotationService>();

    // Baseline: no decryption options. Each arrangement below adds the ones that it needs.
    userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));
    keyConnectorService.getUsesKeyConnector.mockResolvedValue(false);
    keyConnectorService.getManagingOrganization.mockResolvedValue(null as unknown as Organization);
    deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(false));
    userKeyRotationService.shouldUseSdkKeyRotation$.mockReturnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [SecurityKeysComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(mockUserId) },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        { provide: KeyConnectorService, useValue: keyConnectorService },
        { provide: DeviceTrustServiceAbstraction, useValue: deviceTrustService },
        { provide: UserKeyRotationService, useValue: userKeyRotationService },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(SecurityKeysComponent, {
        remove: { imports: [ChangeKdfModule, KeyRotationComponent] },
        add: { imports: [MockChangeKdfComponent, MockKeyRotationComponent] },
      })
      .compileComponents();
  });

  async function renderComponent() {
    fixture = TestBed.createComponent(SecurityKeysComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function keyRotationElement() {
    return fixture.debugElement.query(By.directive(MockKeyRotationComponent));
  }

  describe("showKeyRotation$", () => {
    describe("when the user uses SDK key rotation", () => {
      beforeEach(() => {
        userKeyRotationService.shouldUseSdkKeyRotation$.mockReturnValue(of(true));
      });

      it("shows key rotation for a master password user", async () => {
        userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));

        await renderComponent();

        expect(keyRotationElement()).not.toBeNull();
      });

      it("shows key rotation for a Key Connector user with a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);
        keyConnectorService.getManagingOrganization.mockResolvedValue({} as Organization);

        await renderComponent();

        expect(keyRotationElement()).not.toBeNull();
      });

      it("shows key rotation for a TDE user", async () => {
        deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(true));

        await renderComponent();

        expect(keyRotationElement()).not.toBeNull();
      });

      it("hides key rotation for a Key Connector user without a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);

        await renderComponent();

        expect(keyRotationElement()).toBeNull();
      });
    });

    describe("when the user does not use SDK key rotation", () => {
      beforeEach(() => {
        userKeyRotationService.shouldUseSdkKeyRotation$.mockReturnValue(of(false));
      });

      it("hides key rotation for a master password user", async () => {
        userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(true));

        await renderComponent();

        expect(keyRotationElement()).toBeNull();
      });

      it("hides key rotation for a Key Connector user with a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);
        keyConnectorService.getManagingOrganization.mockResolvedValue({} as Organization);

        await renderComponent();

        expect(keyRotationElement()).toBeNull();
      });

      it("hides key rotation for a TDE user", async () => {
        deviceTrustService.supportsDeviceTrustByUserId$.mockReturnValue(of(true));

        await renderComponent();

        expect(keyRotationElement()).toBeNull();
      });

      it("hides key rotation for a Key Connector user without a managing organization", async () => {
        keyConnectorService.getUsesKeyConnector.mockResolvedValue(true);

        await renderComponent();

        expect(keyRotationElement()).toBeNull();
      });
    });
  });
});
