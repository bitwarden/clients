export class VerifyBankAccountRequest {
  descriptorCode: string;

  constructor(descriptorCode: string) {
    this.descriptorCode = descriptorCode;
  }
}
