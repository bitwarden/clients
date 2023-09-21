export class TrustedDeviceUserDecryptionOption {
  constructor(
    public hasAdminApproval: boolean,
    public hasLoginApprovingDevice: boolean,
    public hasManageResetPasswordPermission: boolean
  ) {}
}
