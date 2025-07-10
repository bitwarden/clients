// @ts-strict-ignore
import { EnpassJsonFile } from "../../enpass/types/enpass-json-type";

import { login } from "./login";

export const loginAndroidUrl: EnpassJsonFile = {
  folders: [],
  items: [
    {
      archived: 0,
      auto_submit: 1,
      category: "login",
      createdAt: 1666449561,
      favorite: 1,
      fields: [
        ...login.items[0].fields,
        {
          deleted: 0,
          label: "Autofill Info",
          order: 9,
          sensitive: 0,
          type: ".Android#",
          uid: 7696,
          updated_at: 1666551057,
          value: "com.amazon.0",
          value_updated_at: 1666551057,
        },
        {
          deleted: 0,
          label: "Autofill Info 1",
          order: 9,
          sensitive: 0,
          type: ".Android#",
          uid: 7696,
          updated_at: 1666551057,
          value:
            "android://pMUhLBalOhcc3yK-84sMiGc2U856FVVUhm8PZveoRfNFT3ocT1KWZlciAkF2ED--B5i_fMuNlC6JfPxcHk1AQg==@com.amazon.1",
          value_updated_at: 1666551057,
        },
        {
          deleted: 0,
          label: "Autofill Info2 ",
          order: 9,
          sensitive: 0,
          type: ".Android#",
          uid: 7696,
          updated_at: 1666551057,
          value: "android://com.amazon.2",
          value_updated_at: 1666551057,
        },
        {
          deleted: 0,
          label: "Autofill Info 3",
          order: 9,
          sensitive: 0,
          type: ".Android#",
          uid: 7696,
          updated_at: 1666551057,
          value: "androidapp://com.amazon.3",
          value_updated_at: 1666551057,
        },
      ],
      icon: {
        fav: "www.amazon.com",
        image: {
          file: "web/amazon.com",
        },
        type: 1,
        uuid: "",
      },
      note: "some notes on the login item",
      subtitle: "emily@enpass.io",
      template_type: "login.default",
      title: "Amazon",
      trashed: 0,
      updated_at: 1666449561,
      uuid: "f717cb7c-6cce-4b24-b023-ec8a429cc992",
    },
  ],
};
