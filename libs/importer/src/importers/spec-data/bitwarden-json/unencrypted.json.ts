export const emptyUnencryptedExport = `{ "encrypted": false,  "folders": [],  "items": [] }`;

// An unencrypted export whose item carries a per-cipher `key` (as produced by clients
// before PM-30442). Importing this previously failed with "no elements in sequence". See PM-39380.
export const unencryptedExportWithCipherKey = JSON.stringify({
  encrypted: false,
  folders: [],
  items: [
    {
      passwordHistory: [],
      revisionDate: "2026-06-23T16:55:07.333Z",
      creationDate: "2026-06-23T16:55:07.333Z",
      id: "263747b7-ada6-46f5-903d-b4720116cfd4",
      type: 1,
      reprompt: 0,
      name: "login",
      notes: "note",
      key: "2.8jY+nJdht+RMrweNUfHf/A==|WD/XE7IPvy9vu50nzJXEtXVqsF4tMQ7Ixs3lGJGBgYcoiWNSMiTL5iv+ws4XsV/LKEBBhlDao/rIFJj+MadMQEleU+Yywm+d0g0MZ6xEih0=|HPuLxp7/X+VOg5bk8CN1E8+GJ0vP+cuVCdivntqTS2c=",
      favorite: false,
      fields: [],
      login: {
        uris: [{ uri: "github.com" }],
        username: "username",
        password: "password",
        totp: null,
      },
      collectionIds: null,
    },
  ],
});

/** Builds an unencrypted export login item with the given HTTP authentication setting. */
const unencryptedLoginItem = (
  id: string,
  httpAuthenticationEnabled?: boolean,
): Record<string, unknown> => ({
  passwordHistory: [],
  revisionDate: "2026-11-06T16:55:07.333Z",
  creationDate: "2026-11-06T16:55:07.333Z",
  id,
  type: 1,
  reprompt: 0,
  name: "login",
  notes: null,
  favorite: false,
  fields: [],
  login: {
    uris: [{ uri: "https://example.com", match: 1 }],
    username: "username",
    password: "password",
    totp: null,
    ...(httpAuthenticationEnabled === undefined ? {} : { httpAuthenticationEnabled }),
  },
  collectionIds: null,
});

// Three logins: HTTP authentication on, off, and absent (as in exports from clients that predate the setting).
export const unencryptedExportWithHTTPAuthentication = JSON.stringify({
  encrypted: false,
  folders: [],
  items: [
    unencryptedLoginItem("4f2a6d1e-7c3b-4e8a-9d5f-1a2b3c4d5e6f", true),
    unencryptedLoginItem("5a3b7e2f-8d4c-4f9b-ae6a-2b3c4d5e6f70", false),
    unencryptedLoginItem("6b4c8f3a-9e5d-4a0c-bf7b-3c4d5e6f7081"),
  ],
});
