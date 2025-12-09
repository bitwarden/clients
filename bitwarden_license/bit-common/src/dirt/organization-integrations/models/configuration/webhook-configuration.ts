import { IOrgIntegrationJsonify } from "../integration-jsonify";

// Added to reflect how future webhook integrations could be structured within the OrganizationIntegration
export class WebhookConfiguration implements IOrgIntegrationJsonify {
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
