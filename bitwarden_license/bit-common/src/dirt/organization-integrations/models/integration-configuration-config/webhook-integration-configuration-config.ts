export class WebhookIntegrationConfigurationConfig {
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
