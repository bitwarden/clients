import { BaseResponse } from "../../../models/response/base.response";

export class ProviderPlansResponse extends BaseResponse {
  planName: string;
  seatMinimum: number;
  purchasedSeats: number;
  cost: number;
  cadence: string;

  constructor(response: any) {
    super(response);
    this.planName = this.getResponseProperty("PlanName");
    this.seatMinimum = this.getResponseProperty("SeatMinimum");
    this.purchasedSeats = this.getResponseProperty("PurchasedSeats");
    this.cost = this.getResponseProperty("Cost");
    this.cadence = this.getResponseProperty("Cadence");
  }
}
