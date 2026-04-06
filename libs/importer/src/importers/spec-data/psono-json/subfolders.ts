import { PsonoJsonExport } from "../../psono/psono-json-types";

export const SubFoldersTestData: PsonoJsonExport = {
  folders: [
    {
      name: "TestFolder",
      folders: [
        {
          name: "SubFolder1",
          folders: [
            {
              name: "SubSubFolder1",
              items: [
                {
                  type: "website_password",
                  name: "TestEntry on SubSubfolder",
                  autosubmit: true,
                  urlfilter: "filter",
                  website_password_title: "TestEntry on SubSubfolder",
                  website_password_url: "bitwarden.com",
                  website_password_username: "testUser",
                  website_password_password: "testPassword",
                  website_password_notes: "some notes",
                  website_password_auto_submit: true,
                  website_password_url_filter: "filter",
                  create_date: "2022-12-13T19:24:09.810266Z",
                  write_date: "2022-12-13T19:24:09.810292Z",
                  callback_url: "callback",
                  callback_user: "callbackUser",
                  callback_pass: "callbackPassword",
                },
              ],
            },
          ],
          items: [
            {
              type: "website_password",
              name: "TestEntry on Subfolder",
              autosubmit: true,
              urlfilter: "filter",
              website_password_title: "TestEntry on Subfolder",
              website_password_url: "bitwarden.com",
              website_password_username: "testUser",
              website_password_password: "testPassword",
              website_password_notes: "some notes",
              website_password_auto_submit: true,
              website_password_url_filter: "filter",
              create_date: "2022-12-13T19:24:09.810266Z",
              write_date: "2022-12-13T19:24:09.810292Z",
              callback_url: "callback",
              callback_user: "callbackUser",
              callback_pass: "callbackPassword",
            },
          ],
        },
      ],
    },
    {
      name: "TestFolder2",
      items: [
        {
          type: "website_password",
          name: "TestEntry2",
          autosubmit: true,
          urlfilter: "filter",
          website_password_title: "TestEntry2",
          website_password_url: "bitwarden.com",
          website_password_username: "testUser",
          website_password_password: "testPassword",
          website_password_notes: "some notes",
          website_password_auto_submit: true,
          website_password_url_filter: "filter",
          create_date: "2022-12-13T19:24:09.810266Z",
          write_date: "2022-12-13T19:24:09.810292Z",
          callback_url: "callback",
          callback_user: "callbackUser",
          callback_pass: "callbackPassword",
        },
      ],
    },
  ],
  items: [],
};
