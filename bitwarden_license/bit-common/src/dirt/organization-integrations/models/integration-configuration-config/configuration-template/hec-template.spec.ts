import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

import { HecTemplate } from "./hec-template";

describe("HecTemplate", () => {
  describe("constructor", () => {
    it("should initialize with index and service name", () => {
      const template = new HecTemplate("main", OrganizationIntegrationServiceName.Huntress);

      expect(template.index).toBe("main");
      expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
    });

    it("should initialize with CrowdStrike service name", () => {
      const template = new HecTemplate("security", OrganizationIntegrationServiceName.CrowdStrike);

      expect(template.index).toBe("security");
      expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.CrowdStrike);
    });

    it("should initialize with empty index", () => {
      const template = new HecTemplate("", OrganizationIntegrationServiceName.Huntress);

      expect(template.index).toBe("");
      expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
    });
  });

  describe("toString", () => {
    it("should produce valid JSON", () => {
      const template = new HecTemplate("main", OrganizationIntegrationServiceName.Huntress);

      expect(() => JSON.parse(template.toString())).not.toThrow();
    });

    it("should include bw_serviceName in output", () => {
      const template = new HecTemplate("main", OrganizationIntegrationServiceName.Huntress);
      const result = JSON.parse(template.toString());

      expect(result.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
    });

    it("should include source as bitwarden", () => {
      const template = new HecTemplate("main", OrganizationIntegrationServiceName.Huntress);
      const result = JSON.parse(template.toString());

      expect(result.source).toBe("bitwarden");
    });

    it("should include service as event-logs", () => {
      const template = new HecTemplate("main", OrganizationIntegrationServiceName.Huntress);
      const result = JSON.parse(template.toString());

      expect(result.service).toBe("event-logs");
    });

    it("should include index when provided", () => {
      const template = new HecTemplate("main", OrganizationIntegrationServiceName.Huntress);
      const result = JSON.parse(template.toString());

      expect(result.index).toBe("main");
    });

    it("should omit index when empty string", () => {
      const template = new HecTemplate("", OrganizationIntegrationServiceName.Huntress);
      const result = JSON.parse(template.toString());

      expect(result.index).toBeUndefined();
    });

    it("should omit index when whitespace only", () => {
      const template = new HecTemplate("   ", OrganizationIntegrationServiceName.Huntress);
      const result = JSON.parse(template.toString());

      expect(result.index).toBeUndefined();
    });

    describe("event object", () => {
      let result: any;

      beforeEach(() => {
        const template = new HecTemplate("main", OrganizationIntegrationServiceName.Huntress);
        result = JSON.parse(template.toString());
      });

      it("should include event object", () => {
        expect(result.event).toBeDefined();
        expect(typeof result.event).toBe("object");
      });

      it("should include core event fields with placeholders", () => {
        expect(result.event.object).toBe("event");
        expect(result.event.type).toBe("#Type#");
        expect(result.event.itemId).toBe("#CipherId#");
        expect(result.event.collectionId).toBe("#CollectionId#");
        expect(result.event.groupId).toBe("#GroupId#");
        expect(result.event.policyId).toBe("#PolicyId#");
        expect(result.event.memberId).toBe("#UserId#");
        expect(result.event.actingUserId).toBe("#ActingUserId#");
        expect(result.event.installationId).toBe("#InstallationId#");
        expect(result.event.date).toBe("#DateIso8601#");
        expect(result.event.device).toBe("#DeviceType#");
        expect(result.event.ipAddress).toBe("#IpAddress#");
      });

      it("should include secrets manager fields with placeholders", () => {
        expect(result.event.secretId).toBe("#SecretId#");
        expect(result.event.projectId).toBe("#ProjectId#");
        expect(result.event.serviceAccountId).toBe("#ServiceAccountId#");
      });

      it("should include acting user enrichment fields", () => {
        expect(result.event.actingUserName).toBe("#ActingUserName#");
        expect(result.event.actingUserEmail).toBe("#ActingUserEmail#");
        expect(result.event.actingUserType).toBe("#ActingUserType#");
      });

      it("should include member enrichment fields", () => {
        expect(result.event.userName).toBe("#UserName#");
        expect(result.event.userEmail).toBe("#UserEmail#");
        expect(result.event.userType).toBe("#UserType#");
      });

      it("should include group enrichment field", () => {
        expect(result.event.groupName).toBe("#GroupName#");
      });
    });

    it("should work with different service names", () => {
      const crowdstrikeTemplate = new HecTemplate(
        "security",
        OrganizationIntegrationServiceName.CrowdStrike,
      );
      const result = JSON.parse(crowdstrikeTemplate.toString());

      expect(result.bw_serviceName).toBe(OrganizationIntegrationServiceName.CrowdStrike);
      expect(result.source).toBe("bitwarden");
      expect(result.event).toBeDefined();
    });
  });
});
