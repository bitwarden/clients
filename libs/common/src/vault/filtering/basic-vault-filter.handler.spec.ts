import { mock } from "jest-mock-extended";

import { BasicFilter, BasicVaultFilterHandler } from "./basic-vault-filter.handler";

describe("BasicVaultFilterHandler", () => {
  const sut = new BasicVaultFilterHandler(mock());

  const successfulCases: { basicFilter: BasicFilter; rawFilter: string }[] = [
    {
      basicFilter: {
        terms: [],
        vaults: [null, "org_vault"],
        collections: ["collection_one", "collection_two"],
        fields: ["field_one", "field_two"],
        types: ["Login", "Card"],
        folders: ["folder_one", "folder_two"],
      },
      rawFilter:
        '(in:my_vault OR in:org:"org_vault") AND (in:folder:"folder_one" OR in:folder:"folder_two") AND (in:collection:"collection_one" AND in:collection:"collection_two") AND (type:"Login" OR type:"Card") AND (has:field:"field_one" AND has:field:"field_two")',
    },
    {
      basicFilter: {
        terms: [],
        vaults: [null, "org_one"],
        collections: [],
        fields: [],
        types: [],
        folders: [],
      },
      rawFilter: `(in:my_vault OR in:org:"org_one")`,
    },
    {
      basicFilter: {
        terms: [],
        vaults: [],
        collections: ["collection_one", "Collection two"],
        fields: [],
        types: [],
        folders: [],
      },
      rawFilter: '(in:collection:"collection_one" AND in:collection:"Collection two")',
    },
    {
      basicFilter: {
        terms: [],
        vaults: [],
        collections: [],
        fields: [],
        types: ["Card", "Login"],
        folders: [],
      },
      rawFilter: '(type:"Card" OR type:"Login")',
    },
    {
      basicFilter: {
        terms: [],
        vaults: [],
        collections: [],
        fields: [],
        types: [],
        folders: ["folder_one", "Folder two"],
      },
      rawFilter: '(in:folder:"folder_one" OR in:folder:"Folder two")',
    },
    {
      basicFilter: {
        terms: [],
        vaults: [],
        collections: [],
        fields: [],
        types: ["Card", "Login"],
        folders: ["folder_one", "Folder two"],
      },
      rawFilter:
        '(in:folder:"folder_one" OR in:folder:"Folder two") AND (type:"Card" OR type:"Login")',
    },
    {
      basicFilter: {
        terms: [],
        vaults: [],
        collections: [],
        fields: ["field_one", "Field two"],
        types: [],
        folders: [],
      },
      rawFilter: '(has:field:"field_one" AND has:field:"Field two")',
    },
    {
      // Example of a filter that we could pretty
      basicFilter: {
        terms: [],
        vaults: [null],
        collections: [],
        fields: [],
        types: [],
        folders: [],
      },
      rawFilter: "(in:my_vault)",
    },
  ];

  describe("tryParse", () => {
    it.each(successfulCases)(
      "successfully parses $rawFilter query into basic filter",
      ({ basicFilter, rawFilter }, done) => {
        const result = sut.tryParse(rawFilter);

        if (!result.success) {
          done("Result is expected to succeed");
          return;
        }

        expect(result.filter).toEqual(basicFilter);
        done();
      },
    );

    // These are cases where they are parsable but they would never be generated this way via the normal basic
    const extraAllowedSyntax: { basicFilter: BasicFilter; rawFilter: string }[] = [
      {
        basicFilter: {
          terms: [],
          vaults: [null],
          collections: [],
          fields: [],
          types: [],
          folders: [],
        },
        rawFilter: "in:my_vault",
      },
      {
        basicFilter: {
          terms: [],
          vaults: [],
          collections: ["my_collection"],
          fields: [],
          types: [],
          folders: [],
        },
        rawFilter: 'in:collection:"my_collection"',
      },
      {
        basicFilter: {
          terms: [],
          vaults: [],
          collections: [],
          fields: [],
          types: ["Login"],
          folders: [],
        },
        rawFilter: 'type:"Login"',
      },
      {
        basicFilter: {
          terms: [],
          vaults: [],
          collections: [],
          fields: [],
          types: [],
          folders: ["my_folder"],
        },
        rawFilter: 'in:folder:"my_folder"',
      },
    ];

    it.each(extraAllowedSyntax)(
      "allows parsing of filter $rawFilter",
      ({ basicFilter, rawFilter }, done) => {
        const result = sut.tryParse(rawFilter);

        if (!result.success) {
          done("Result is expected to succeed");
          return;
        }

        expect(result.filter).toEqual(basicFilter);
        done();
      },
    );

    const unrepresentableInBasic: string[] = [
      // We use OR for folders
      '(in:folder:"folder_one" AND in:folder:"Folder two")',
      // We use OR for vaults
      '(in:my_vault AND in:org:"Org one")',
      // We use AND for collections but we could offer the selection and in the case this could be valid too
      '(in:collection:"Collection one" OR in:collection:"Collection two")',
      // We use OR for type
      '(type:"Login" AND type:"Card")',
      // We wouldn't put the same expression in multiple groups - This is a place where we could get smarter
      '(type:"Login") AND (type:"Card")',
    ];

    it.each(unrepresentableInBasic)("does not succeed when filter is %s", (filter) => {
      const result = sut.tryParse(filter);

      expect(result.success).toBe(false);
    });
  });

  describe("toFilter", () => {
    it.each(successfulCases)(
      "translates basic filter to $rawFilter",
      ({ basicFilter, rawFilter }) => {
        const actualOutput = sut.toFilter(basicFilter);

        expect(actualOutput).toEqual(rawFilter);
      },
    );
  });
});
