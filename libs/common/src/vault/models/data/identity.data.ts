import { IdentityApi } from "../api/identity.api";

export class IdentityData {
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  company?: string;
  email?: string;
  phone?: string;
  ssn?: string;
  username?: string;
  passportNumber?: string;
  licenseNumber?: string;

  constructor(data?: IdentityApi) {
    if (data == null) {
      return;
    }

    this.title = data.title;
    this.firstName = data.firstName;
    this.middleName = data.middleName;
    this.lastName = data.lastName;
    this.address1 = data.address1;
    this.address2 = data.address2;
    this.address3 = data.address3;
    this.city = data.city;
    this.state = data.state;
    this.postalCode = data.postalCode;
    this.country = data.country;
    this.company = data.company;
    this.email = data.email;
    this.phone = data.phone;
    this.ssn = data.ssn;
    this.username = data.username;
    this.passportNumber = data.passportNumber;
    this.licenseNumber = data.licenseNumber;
  }
}
