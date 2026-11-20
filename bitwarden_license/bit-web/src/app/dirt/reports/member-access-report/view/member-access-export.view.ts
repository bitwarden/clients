export type MemberAccessExportItem = {
  email?: string;
  name?: string;
  twoStepLogin?: string;
  accountRecovery?: string;
  group?: string;
  collection: string;
  collectionPermission: string;
  totalItems: string;
};

export const userReportItemHeaders: { [key in keyof MemberAccessExportItem]: string } = {
  email: "Email",
  name: "Name",
  twoStepLogin: "Two-Step Login",
  accountRecovery: "Account Recovery",
  group: "Group",
  collection: "Shared Folder",
  collectionPermission: "Shared Folder Permission",
  totalItems: "Total Items",
};
