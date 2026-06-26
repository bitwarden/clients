import { OrganizationUserResetPasswordDetailsResponse } from "./organization-user.response";

describe("OrganizationUserResetPasswordDetailsResponse", () => {
  it("should populate masterPasswordSalt from the response payload", () => {
    const response = new OrganizationUserResetPasswordDetailsResponse({
      OrganizationUserId: "org-user-id",
      Kdf: 0,
      KdfIterations: 100000,
      MasterPasswordSalt: "server-side-salt",
      ResetPasswordKey: "reset-password-key",
      EncryptedPrivateKey: "encrypted-private-key",
    });

    expect(response.masterPasswordSalt).toBe("server-side-salt");
  });

  it("should leave masterPasswordSalt undefined when absent from the payload", () => {
    const response = new OrganizationUserResetPasswordDetailsResponse({
      OrganizationUserId: "org-user-id",
      Kdf: 0,
      KdfIterations: 100000,
      ResetPasswordKey: "reset-password-key",
      EncryptedPrivateKey: "encrypted-private-key",
    });

    expect(response.masterPasswordSalt).toBeUndefined();
  });
});
