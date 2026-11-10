export class UpdateProviderOrganizationRequest {
  assignedSeats: number;
  name: string;

  constructor(c: { assignedSeats: number; name: string }) {
    this.assignedSeats = c.assignedSeats;
    this.name = c.name;
  }
}
