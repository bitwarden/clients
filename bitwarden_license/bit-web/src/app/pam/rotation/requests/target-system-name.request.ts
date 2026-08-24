/**
 * Body for `PUT /organizations/{orgId}/rotation/target-systems/{targetSystemId}/name`.
 * Renames a target system.
 */
export class TargetSystemNameRequest {
  name: string;

  constructor(init: { name: string }) {
    this.name = init.name;
  }
}
