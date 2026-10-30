import { mock, MockProxy } from "jest-mock-extended";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { ProviderData } from "@bitwarden/common/admin-console/models/data/provider.data";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { UpdateProviderOrganizationRequest } from "@bitwarden/common/admin-console/models/request/update-provider-organization.request";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { ProviderSubscriptionResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef } from "@bitwarden/components";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";

import {
  ManageClientSubscriptionDialogComponent,
  ManageClientSubscriptionDialogResultType,
} from "./manage-client-subscription-dialog.component";

type PlanSeats = { seatMinimum: number; assignedSeats: number; purchasedSeats: number };

describe("ManageClientSubscriptionDialogComponent", () => {
  const providerId = "provider-id";
  const organizationId = "organization-id";
  const planName = "Teams (Monthly)";

  // Org currently has 10 seats, 5 occupied. Provider plan has 10 open seats.
  const openSeatsPlan: PlanSeats = { seatMinimum: 100, assignedSeats: 90, purchasedSeats: 0 };
  const purchasedSeatsPlan: PlanSeats = { seatMinimum: 100, assignedSeats: 105, purchasedSeats: 5 };

  let billingApiService: MockProxy<BillingApiServiceAbstraction>;
  let providerApiService: MockProxy<ProviderApiServiceAbstraction>;
  let dialogRef: MockProxy<DialogRef<ManageClientSubscriptionDialogResultType>>;
  let i18nService: MockProxy<I18nService>;
  let billingNotificationService: MockProxy<BillingNotificationService>;

  beforeEach(() => {
    billingApiService = mock();
    providerApiService = mock();
    dialogRef = mock();
    i18nService = mock();
    billingNotificationService = mock();

    i18nService.t.mockImplementation((key: string) => key);
  });

  const createComponent = async (
    providerType: ProviderUserType,
    plan: PlanSeats | null,
    occupiedSeats: number | null = 5,
  ): Promise<ManageClientSubscriptionDialogComponent> => {
    billingApiService.getProviderSubscription.mockResolvedValue(
      new ProviderSubscriptionResponse({
        plans:
          plan == null
            ? []
            : [
                {
                  PlanName: planName,
                  SeatMinimum: plan.seatMinimum,
                  AssignedSeats: plan.assignedSeats,
                  PurchasedSeats: plan.purchasedSeats,
                },
              ],
      }),
    );

    const component = new ManageClientSubscriptionDialogComponent(
      billingApiService,
      providerApiService,
      {
        organization: new ProviderOrganizationOrganizationDetailsResponse({
          Id: organizationId,
          Seats: 10,
          OccupiedSeats: occupiedSeats ?? undefined,
          Plan: planName,
          OrganizationName: "Client Org",
        }),
        provider: new Provider({ id: providerId, type: providerType } as ProviderData),
      },
      dialogRef,
      i18nService,
      billingNotificationService,
    );

    await component.ngOnInit();

    return component;
  };

  const setAssignedSeats = (component: ManageClientSubscriptionDialogComponent, seats: number) =>
    component["formGroup"].controls.assignedSeats.setValue(seats);

  const assignedSeatsControl = (component: ManageClientSubscriptionDialogComponent) =>
    component["formGroup"].controls.assignedSeats;

  describe("seat validation", () => {
    it("allows a provider admin to add seats", async () => {
      const component = await createComponent(ProviderUserType.ProviderAdmin, purchasedSeatsPlan);

      setAssignedSeats(component, 20);

      expect(assignedSeatsControl(component).hasError("insufficientPermissions")).toBe(false);
    });

    it("blocks a service user with purchased seats from adding seats", async () => {
      const component = await createComponent(ProviderUserType.ServiceUser, purchasedSeatsPlan);

      setAssignedSeats(component, 11);

      expect(assignedSeatsControl(component).errors?.insufficientPermissions).toEqual({
        message: "contactYourProviderForAdditionalSeats",
      });
    });

    it("allows a service user with purchased seats to remove seats", async () => {
      const component = await createComponent(ProviderUserType.ServiceUser, purchasedSeatsPlan);

      setAssignedSeats(component, 8);

      expect(assignedSeatsControl(component).hasError("insufficientPermissions")).toBe(false);
    });

    it("allows a service user with purchased seats to keep the current seats", async () => {
      const component = await createComponent(ProviderUserType.ServiceUser, purchasedSeatsPlan);

      setAssignedSeats(component, 10);

      expect(assignedSeatsControl(component).hasError("insufficientPermissions")).toBe(false);
    });

    it("allows a service user without purchased seats to add seats within the open seats", async () => {
      const component = await createComponent(ProviderUserType.ServiceUser, openSeatsPlan);

      setAssignedSeats(component, 20);

      expect(assignedSeatsControl(component).hasError("insufficientPermissions")).toBe(false);
    });

    it("blocks a service user without purchased seats from adding more than the open seats", async () => {
      const component = await createComponent(ProviderUserType.ServiceUser, openSeatsPlan);

      setAssignedSeats(component, 21);

      expect(assignedSeatsControl(component).errors?.insufficientPermissions).toEqual({
        message: "unassignedSeatsAvailable contactYourProviderForAdditionalSeats",
      });
    });

    it("rejects fewer seats than the organization occupies", async () => {
      const component = await createComponent(ProviderUserType.ProviderAdmin, openSeatsPlan);

      setAssignedSeats(component, 4);

      expect(assignedSeatsControl(component).hasError("min")).toBe(true);
    });

    it("rejects negative seats when the occupied seats are unknown", async () => {
      const component = await createComponent(ProviderUserType.ProviderAdmin, openSeatsPlan, null);

      setAssignedSeats(component, -1);

      expect(assignedSeatsControl(component).hasError("min")).toBe(true);
    });

    it.each([
      ["with", purchasedSeatsPlan],
      ["without", openSeatsPlan],
    ])(
      "leaves an empty value to the required validator for a service user %s purchased seats",
      async (_, plan) => {
        const component = await createComponent(ProviderUserType.ServiceUser, plan);

        // A cleared number input writes null despite the nonNullable control type
        assignedSeatsControl(component).setValue(null as unknown as number);

        expect(assignedSeatsControl(component).errors).toEqual({ required: true });
      },
    );

    it("stops loading without seat validation when the provider plan is not found", async () => {
      const component = await createComponent(ProviderUserType.ServiceUser, null);

      setAssignedSeats(component, 100);

      expect(component["loading"]).toBe(false);
      expect(assignedSeatsControl(component).hasError("insufficientPermissions")).toBe(false);
    });
  });

  describe("submit", () => {
    it("updates the client organization and closes the dialog", async () => {
      const component = await createComponent(ProviderUserType.ProviderAdmin, openSeatsPlan);
      setAssignedSeats(component, 12);

      await component.submit();

      expect(providerApiService.updateProviderOrganization).toHaveBeenCalledWith(
        providerId,
        organizationId,
        new UpdateProviderOrganizationRequest({ assignedSeats: 12, name: "Client Org" }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith(
        ManageClientSubscriptionDialogResultType.Submitted,
      );
    });

    it("does not update the client organization when the form is invalid", async () => {
      const component = await createComponent(ProviderUserType.ProviderAdmin, openSeatsPlan);
      setAssignedSeats(component, 4);

      await component.submit();

      expect(providerApiService.updateProviderOrganization).not.toHaveBeenCalled();
    });
  });

  describe("seat summary", () => {
    it.each([
      [8, 12],
      [15, 5],
      [25, 0],
    ])("shows the unassigned seats left when assigning %i seats", async (seats, expected) => {
      const component = await createComponent(ProviderUserType.ServiceUser, openSeatsPlan);

      setAssignedSeats(component, seats);

      expect(component.unassignedSeats).toBe(expected);
    });

    it.each([
      [openSeatsPlan, 25, 5],
      [openSeatsPlan, 15, -5],
      [purchasedSeatsPlan, 13, 3],
      [purchasedSeatsPlan, 8, -2],
    ])(
      "shows the additional seats purchased for plan %o when assigning %i seats",
      async (plan, seats, expected) => {
        const component = await createComponent(ProviderUserType.ProviderAdmin, plan);

        setAssignedSeats(component, seats);

        expect(component.additionalSeatsPurchased).toBe(expected);
      },
    );

    it.each([
      [purchasedSeatsPlan, 7, 3],
      [purchasedSeatsPlan, 2, 5],
      [openSeatsPlan, 7, 0],
    ])(
      "shows the purchased seats removed for plan %o when assigning %i seats",
      async (plan, seats, expected) => {
        const component = await createComponent(ProviderUserType.ProviderAdmin, plan);

        setAssignedSeats(component, seats);

        expect(component.purchasedSeatsRemoved).toBe(expected);
      },
    );
  });
});
