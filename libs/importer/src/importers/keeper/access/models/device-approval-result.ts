export class DeviceApprovalResult {
  static cancel = new DeviceApprovalResult(false);

  constructor(public success: boolean) {}
}
