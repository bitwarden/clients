// Added to reflect how future webhook integrations could be structured within the OrganizationIntegration
export class WebhookConfiguration {
  propA: string;
  propB: string;

  constructor(propA: string, propB: string) {
    this.propA = propA;
    this.propB = propB;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
