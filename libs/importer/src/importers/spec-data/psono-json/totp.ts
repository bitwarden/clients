import { PsonoJsonExport } from "../../psono/psono-json-types";

export const TOTPData: PsonoJsonExport = {
  folders: [],
  items: [
    {
      type: "totp",
      name: "My TOTP",
      totp_title: "My TOTP",
      totp_period: 30,
      totp_algorithm: "SHA1",
      totp_digits: 6,
      totp_code: "someSecretOfMine",
      totp_notes: "Notes for TOTP",
      create_date: "2022-12-13T19:41:42.972586Z",
      write_date: "2022-12-13T19:41:42.972609Z",
      callback_url: "",
      callback_user: "",
      callback_pass: "",
    },
  ],
};
