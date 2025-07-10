import { EnpassJsonFile } from "../../enpass/types/enpass-json-type";

export const folders: EnpassJsonFile = {
  folders: [
    {
      icon: "1008",
      parent_uuid: "",
      title: "Social",
      updated_at: 1666449561,
      uuid: "7b2ed0da-8cd9-445f-9a1a-490ca2b9ffbc",
    },
    {
      icon: "1008",
      parent_uuid: "7b2ed0da-8cd9-445f-9a1a-490ca2b9ffbc",
      title: "Twitter",
      updated_at: 1666450857,
      uuid: "7fe8a8bc-b848-4f9f-9870-c2936317e74d",
    },
  ],
  items: [
    {
      archived: 0,
      auto_submit: 1,
      category: "note",
      createdAt: 1666554621,
      favorite: 0,
      folders: ["7fe8a8bc-b848-4f9f-9870-c2936317e74d"],
      icon: {
        fav: "",
        image: {
          file: "misc/secure_note",
        },
        type: 1,
        uuid: "",
      },
      note: "some secure note content",
      subtitle: "",
      template_type: "note.default",
      title: "some secure note title",
      trashed: 0,
      updated_at: 1666554621,
      uuid: "8b5ea2f6-f62b-4fec-a235-4a40946026b6",
    },
  ],
};
