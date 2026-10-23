import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";
import { PublicKey } from "@bitwarden/sdk-internal";

import { KeyRotationTrustInfoComponent } from "../key-rotation/key-rotation-trust-info.component";

import { AccountRecoveryTrustComponent } from "./account-recovery-trust.component";
import { DefaultUserCryptoDialogService } from "./default-user-crypto-dialog.service";
import { EmergencyAccessBulkTrustComponent } from "./emergency-access-bulk-trust.component";

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

  const secondEaPublicKeyB64 = Utils.fromBufferToB64(new Uint8Array([7, 8, 9]).buffer) as PublicKey;
  const secondEmergencyAccessMembership = {
    id: "secondId" as any,
    grantee_id: "secondGranteeId" as any,
    name: "secondName",
    public_key: secondEaPublicKeyB64,
  };

  const closedTrue = { closed: new BehaviorSubject(true) } as any;
  const closedFalse = { closed: new BehaviorSubject(false) } as any;
  const closedWith = (value: unknown) => ({ closed: new BehaviorSubject(value) }) as any;

  beforeEach(() => {
    mockDialogService = mock<DialogService>();

    infoOpenSpy = jest.spyOn(KeyRotationTrustInfoComponent, "open").mockReturnValue(closedTrue);
    accountRecoveryOpenSpy = jest
      .spyOn(AccountRecoveryTrustComponent, "open")
      .mockReturnValue(closedTrue);
    emergencyAccessOpenSpy = jest
      .spyOn(EmergencyAccessBulkTrustComponent, "open")
      .mockReturnValue(closedWith([mockEmergencyAccessMembership.id]));

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

  it("returns denied when the emergency access dialog is skipped", async () => {
    emergencyAccessOpenSpy.mockReturnValue(closedWith(undefined));

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

  it("does not open the info dialog when only emergency access users exist", async () => {
    await service.verifyTrust([], [mockEmergencyAccessMembership]);

    expect(infoOpenSpy).not.toHaveBeenCalled();
  });

  it("passes all emergency access contacts to a single dialog", async () => {
    await service.verifyTrust([], [mockEmergencyAccessMembership, secondEmergencyAccessMembership]);

    expect(emergencyAccessOpenSpy).toHaveBeenCalledTimes(1);
    expect(emergencyAccessOpenSpy).toHaveBeenCalledWith(mockDialogService, {
      contacts: [
        {
          id: mockEmergencyAccessMembership.id,
          granteeId: mockEmergencyAccessMembership.grantee_id,
          name: mockEmergencyAccessMembership.name,
          publicKey: new Uint8Array([1, 2, 3]),
        },
        {
          id: secondEmergencyAccessMembership.id,
          granteeId: secondEmergencyAccessMembership.grantee_id,
          name: secondEmergencyAccessMembership.name,
          publicKey: new Uint8Array([7, 8, 9]),
        },
      ],
    });
  });

  it("returns only the keys of the selected emergency access contacts", async () => {
    emergencyAccessOpenSpy.mockReturnValue(closedWith([secondEmergencyAccessMembership.id]));

    const result = await service.verifyTrust(
      [],
      [mockEmergencyAccessMembership, secondEmergencyAccessMembership],
    );

    expect(result).toEqual({
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: [],
      trustedEmergencyAccessUserPublicKeys: [secondEaPublicKeyB64],
    });
  });

  it("returns no emergency access keys when no contacts are selected", async () => {
    emergencyAccessOpenSpy.mockReturnValue(closedWith([]));

    const result = await service.verifyTrust([], [mockEmergencyAccessMembership]);

    expect(result).toEqual({
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: [],
      trustedEmergencyAccessUserPublicKeys: [],
    });
  });
});
