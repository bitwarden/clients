// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class ServiceAccountView {
  id: string;
  organizationId: string;
  name: string;
  creationDate: string;
  revisionDate: string;
}

export class ServiceAccountSecretsDetailsView extends ServiceAccountView {
  accessToSecrets: number;
}
