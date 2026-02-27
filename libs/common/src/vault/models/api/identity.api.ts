// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";

export class IdentityApi extends BaseResponse {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  company: string;
  email: string;
  phone: string;
  ssn: string;
  username: string;
  passportNumber: string;
  licenseNumber: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.title = this.getResponseProperty("Title");
    this.firstName = this.getResponseProperty("FirstName");
    this.middleName = this.getResponseProperty("MiddleName");
    this.lastName = this.getResponseProperty("LastName");
    this.address1 = this.getResponseProperty("Address1");
    this.address2 = this.getResponseProperty("Address2");
    this.address3 = this.getResponseProperty("Address3");
    this.city = this.getResponseProperty("City");
    this.state = this.getResponseProperty("State");
    this.postalCode = this.getResponseProperty("PostalCode");
    this.country = this.getResponseProperty("Country");
    this.company = this.getResponseProperty("Company");
    this.email = this.getResponseProperty("Email");
    this.phone = this.getResponseProperty("Phone");
    this.ssn = this.getResponseProperty("SSN");
    this.username = this.getResponseProperty("Username");
    this.passportNumber = this.getResponseProperty("PassportNumber");
    this.licenseNumber = this.getResponseProperty("LicenseNumber");
  }
}
