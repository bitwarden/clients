import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";
import { PublicKey } from "@bitwarden/sdk-internal";

import { KeyRotationTrustInfoComponent } from "../key-rotation/key-rotation-trust-info.component";

import { AccountRecoveryTrustComponent } from "./account-recovery-trust.component";
import { DefaultUserCryptoDialogService } from "./default-user-crypto-dialog.service";
import { EmergencyAccessTrustComponent } from "./emergency-access-trust.component";

describe("DefaultUserCryptoDialogService", () => {
  let service: DefaultUserCryptoDialogService;
  let mockDialogService: MockProxy<DialogService>;

  let infoOpenSpy: jest.SpyInstance;
  let accountRecoveryOpenSpy: jest.SpyInstance;
  let emergencyAccessOpenSpy: jest.SpyInstance;

  const orgPublicKeyB64 = Utils.fromBufferToB64(new Uint8Array([4, 5, 6]).buffer) as PublicKey;
  const eaPublicKeyB64 = Utils.fromBufferToB64(new Uint8Array([1, 2, 3]).buffer) as PublicKey;

  const mockOrganizationMembership = {
    organization_id: "mockOrgId" as any,
    name: "mockOrgName",
    public_key: orgPublicKeyB64,
  };

  const mockEmergencyAccessMembership = {
    id: "mockId" as any,
    grantee_id: "mockGranteeId" as any,
    name: "mockName",
    public_key: eaPublicKeyB64,
  };

  const closedTrue = { closed: new BehaviorSubject(true) } as any;
  const closedFalse = { closed: new BehaviorSubject(false) } as any;

  beforeEach(() => {
    mockDialogService = mock<DialogService>();

    infoOpenSpy = jest.spyOn(KeyRotationTrustInfoComponent, "open").mockReturnValue(closedTrue);
    accountRecoveryOpenSpy = jest
      .spyOn(AccountRecoveryTrustComponent, "open")
      .mockReturnValue(closedTrue);
    emergencyAccessOpenSpy = jest
      .spyOn(EmergencyAccessTrustComponent, "open")
      .mockReturnValue(closedTrue);

    service = new DefaultUserCryptoDialogService(mockDialogService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns trusted with empty arrays and does not open dialogs when no memberships exist", async () => {
    const result = await service.verifyTrust([], []);

    expect(result).toEqual({
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: [],
      trustedEmergencyAccessUserPublicKeys: [],
    });
    expect(infoOpenSpy).not.toHaveBeenCalled();
    expect(accountRecoveryOpenSpy).not.toHaveBeenCalled();
    expect(emergencyAccessOpenSpy).not.toHaveBeenCalled();
  });

  it("returns denied when the info dialog is closed", async () => {
    infoOpenSpy.mockReturnValue(closedFalse);

    const result = await service.verifyTrust(
      [mockOrganizationMembership],
      [mockEmergencyAccessMembership],
    );

    expect(result).toEqual({
      wasTrustDenied: true,
      trustedOrganizationPublicKeys: [],
      trustedEmergencyAccessUserPublicKeys: [],
    });
    expect(accountRecoveryOpenSpy).not.toHaveBeenCalled();
    expect(emergencyAccessOpenSpy).not.toHaveBeenCalled();
  });

  it("returns denied when the account recovery dialog is closed", async () => {
    accountRecoveryOpenSpy.mockReturnValue(closedFalse);

    const result = await service.verifyTrust(
      [mockOrganizationMembership],
      [mockEmergencyAccessMembership],
    );

    expect(result).toEqual({
      wasTrustDenied: true,
      trustedOrganizationPublicKeys: [],
      trustedEmergencyAccessUserPublicKeys: [],
    });
    expect(emergencyAccessOpenSpy).not.toHaveBeenCalled();
  });

  it("returns denied when the emergency access dialog is closed", async () => {
    emergencyAccessOpenSpy.mockReturnValue(closedFalse);

    const result = await service.verifyTrust([], [mockEmergencyAccessMembership]);

    expect(result).toEqual({
      wasTrustDenied: true,
      trustedOrganizationPublicKeys: [],
      trustedEmergencyAccessUserPublicKeys: [],
    });
  });

  it("returns trusted keys when all dialogs are confirmed with only emergency access users", async () => {
    const result = await service.verifyTrust([], [mockEmergencyAccessMembership]);

    expect(result).toEqual({
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: [],
      trustedEmergencyAccessUserPublicKeys: [eaPublicKeyB64],
    });
  });

  it("returns trusted keys when all dialogs are confirmed with only organizations", async () => {
    const result = await service.verifyTrust([mockOrganizationMembership], []);

    expect(result).toEqual({
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: [orgPublicKeyB64],
      trustedEmergencyAccessUserPublicKeys: [],
    });
  });

  it("returns trusted keys when all dialogs are confirmed with both organizations and emergency access users", async () => {
    const result = await service.verifyTrust(
      [mockOrganizationMembership],
      [mockEmergencyAccessMembership],
    );

    expect(result).toEqual({
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: [orgPublicKeyB64],
      trustedEmergencyAccessUserPublicKeys: [eaPublicKeyB64],
    });
  });

  it("passes the org name and emergency access user count to the info dialog when organizations exist", async () => {
    await service.verifyTrust([mockOrganizationMembership], []);

    expect(infoOpenSpy).toHaveBeenCalledWith(mockDialogService, {
      numberOfEmergencyAccessUsers: 0,
      orgName: mockOrganizationMembership.name,
    });
  });

  it("passes the emergency access user count to the info dialog when only emergency access users exist", async () => {
    await service.verifyTrust([], [mockEmergencyAccessMembership]);

    expect(infoOpenSpy).toHaveBeenCalledWith(mockDialogService, {
      numberOfEmergencyAccessUsers: 1,
      orgName: undefined,
    });
  });
});
