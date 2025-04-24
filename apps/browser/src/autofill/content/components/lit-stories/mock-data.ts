import { ProductTierTypes } from "@bitwarden/common/billing/enums";

export const mockFolderData = [
  {
    id: "unique-id1",
    name: "A folder",
  },
  {
    id: "unique-id2",
    name: "Another folder",
  },
  {
    id: "unique-id3",
    name: "One more folder",
  },
  {
    id: "unique-id4",
    name: "Definitely not a folder",
  },
  {
    id: "unique-id5",
    name: "Yet another folder",
  },
  {
    id: "unique-id6",
    name: "Something else entirely, with an essence being completely unfolder-like in all the unimportant ways and none of the important ones",
  },
  {
    id: "unique-id7",
    name: 'A "folder"',
  },
  {
    id: "unique-id8",
    name: "Two folders",
  },
];

export const mockOrganizationData = [
  {
    id: "unique-id0",
    name: "Another personal vault",
  },
  {
    id: "unique-id1",
    name: "Acme, inc",
    productTierType: ProductTierTypes.Teams,
  },
  {
    id: "unique-id2",
    name: "A Really Long Business Name That Just Kinda Goes On For A Really Long Time",
    productTierType: ProductTierTypes.TeamsStarter,
  },
  {
    id: "unique-id3",
    name: "Family Vault",
    productTierType: ProductTierTypes.Families,
  },
  {
    id: "unique-id4",
    name: "Family Vault Trial",
    productTierType: ProductTierTypes.Free,
  },
  {
    id: "unique-id5",
    name: "Exciting Enterprises, LLC",
    productTierType: ProductTierTypes.Enterprise,
  },
];
