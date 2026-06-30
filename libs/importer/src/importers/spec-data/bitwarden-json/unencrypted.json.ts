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
