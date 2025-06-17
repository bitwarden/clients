import { OrganizationId, ProviderId } from "@bitwarden/common/types/guid";

export type BillableEntity =
  | {
      type: "account";
    }
  | {
      type: "organization";
      id: OrganizationId;
      useCase: "personal" | "business";
    }
  | {
      type: "provider";
      id: ProviderId;
    };

export const getUseCase = (billableEntity: BillableEntity): "personal" | "business" => {
  switch (billableEntity.type) {
    case "account": {
      return "personal";
    }
    case "organization": {
      return billableEntity.useCase;
    }
    case "provider": {
      return "business";
    }
  }
};
