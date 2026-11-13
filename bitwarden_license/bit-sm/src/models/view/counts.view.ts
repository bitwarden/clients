export type OrganizationCounts = {
  projects: number;
  secrets: number;
  serviceAccounts: number;
};

export type ProjectCounts = {
  secrets: number;
  people: number;
  serviceAccounts: number;
};

export type ServiceAccountCounts = {
  projects: number;
  people: number;
  accessTokens: number;
};
