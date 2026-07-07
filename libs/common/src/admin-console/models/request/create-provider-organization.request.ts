import { PlanType } from "../../../billing/enums";

import { OrganizationKeysRequest } from "./organization-keys.request";

export class CreateProviderOrganizationRequest {
  name: string;
  ownerEmail: string;
  planType: PlanType;
  seats: number;
  key: string;
  keyPair: OrganizationKeysRequest;
  collectionName: string;

  constructor(
    name: string,
    ownerEmail: string,
    planType: PlanType,
    seats: number,
    key: string,
    keyPair: OrganizationKeysRequest,
    collectionName: string,
  ) {
    if (!name) {
      throw new Error("Name is required");
    }
    if (!ownerEmail) {
      throw new Error("Owner email is required");
    }
    if (planType == null) {
      throw new Error("Plan type is required");
    }
    if (seats == null) {
      throw new Error("Seats is required");
    }
    if (!key) {
      throw new Error("Organization key is required");
    }
    if (!keyPair) {
      throw new Error("Organization key pair is required");
    }
    if (!collectionName) {
      throw new Error("Collection name is required");
    }
    this.name = name;
    this.ownerEmail = ownerEmail;
    this.planType = planType;
    this.seats = seats;
    this.key = key;
    this.keyPair = keyPair;
    this.collectionName = collectionName;
  }
}
