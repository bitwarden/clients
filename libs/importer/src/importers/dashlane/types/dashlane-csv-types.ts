// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// tslint:disable
export class CredentialsRecord {
  username: string;
  username2: string;
  username3: string;
  title: string;
  password: string;
  note: string;
  url: string;
  category: string;
  otpSecret?: string;
  otpUrl?: string; // Likely introduced by Dashlane as a replacement for `otpSecret`
}

export class PaymentsRecord {
  type: string;
  account_name: string;
  account_holder: string;
  cc_number: string;
  code: string;
  expiration_month: string;
  expiration_year: string;
  routing_number: string;
  account_number: string;
  country: string;
  issuing_bank: string;
}

export class IdRecord {
  type: string;
  number: string;
  name: string;
  issue_date: string;
  expiration_date: string;
  place_of_issue: string;
  state: string;
}

export class PersonalInformationRecord {
  type: string;
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  login: string;
  date_of_birth: string;
  place_of_birth: string;
  email: string;
  email_type: string;
  item_name: string;
  phone_number: string;
  address: string;
  country: string;
  state: string;
  city: string;
  zip: string;
  address_recipient: string;
  address_building: string;
  address_apartment: string;
  address_floor: string;
  address_door_code: string;
  job_title: string;
  url: string;
}

export class SecureNoteRecord {
  title: string;
  note: string;
}
