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
