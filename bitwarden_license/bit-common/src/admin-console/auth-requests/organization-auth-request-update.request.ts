export class OrganizationAuthRequestUpdateRequest {
  constructor(
    public id: string,
    public approved: boolean,
    public key?: string,
  ) {}
}
