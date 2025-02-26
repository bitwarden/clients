import { KeeperJsonExport } from "../../keeper/types/keeper-json-types";

export const testData: KeeperJsonExport = {
  shared_folders: [
    {
      path: "My Customer 1",
      manage_users: true,
      manage_records: true,
      can_edit: true,
      can_share: true,
      permissions: [
        {
          uid: "kVM96KGEoGxhskZoSTd_jw",
          manage_users: true,
          manage_records: true,
        },
        {
          name: "user@mycompany.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "Testing\\My Customer 2",
      manage_users: true,
      manage_records: true,
      can_edit: true,
      can_share: true,
      permissions: [
        {
          uid: "ih1CggiQ-3ENXcn4G0sl-g",
          manage_users: true,
          manage_records: true,
        },
        {
          name: "user@mycompany.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
  ],
  records: [
    {
      title: "Bank Account 1",
      login: "customer1234",
      password: "4813fJDHF4239fdk",
      login_url: "https://chase.com",
      notes: "These are some notes.",
      custom_fields: {
        "Account Number": "123-456-789",
      },
      folders: [
        {
          folder: "Optional Private Folder 1",
        },
      ],
    },
    {
      title: "Bank Account 2",
      login: "mybankusername",
      password: "w4k4k193f$^&@#*%2",
      login_url: "https://amex.com",
      notes: "Some great information here.",
      custom_fields: {
        "Security Group": "Public",
        "IP Address": "12.45.67.8",
        "TFC:Keeper":
          "otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30",
      },
      folders: [
        {
          folder: "Optional Private Folder 1",
        },
        {
          shared_folder: "My Customer 1",
          can_edit: true,
          can_share: true,
        },
      ],
    },
    {
      title: "Some Account",
      login: "someUserName",
      password: "w4k4k1wergf$^&@#*%2",
      login_url: "https://example.com",
    },
  ],
};
