import { Component, Signal } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { IntegrationType } from "@bitwarden/common/enums";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-integrations",
  templateUrl: "./integrations.component.html",
  standalone: false,
})
export class IntegrationsComponent {
  constructor(private state: IntegrationStateService) {
    const integrations = [
      {
        name: "Rust",
        linkURL: "https://github.com/bitwarden/sdk-sm",
        image: "../../../../../../../images/secrets-manager/sdks/rust.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/sdks/rust-white.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "GitHub Actions",
        linkURL: "https://bitwarden.com/help/github-actions-integration/",
        image: "../../../../../../../images/secrets-manager/integrations/github.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/integrations/github-white.svg",
        type: IntegrationType.Integration,
      },
      {
        name: "GitLab CI/CD",
        linkURL: "https://bitwarden.com/help/gitlab-integration/",
        image: "../../../../../../../images/secrets-manager/integrations/gitlab.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/integrations/gitlab-white.svg",
        type: IntegrationType.Integration,
      },
      {
        name: "Ansible",
        linkURL: "https://galaxy.ansible.com/ui/repo/published/bitwarden/secrets",
        image: "../../../../../../../images/secrets-manager/integrations/ansible.svg",
        type: IntegrationType.Integration,
      },
      {
        name: "C#",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/csharp",
        image: "../../../../../../../images/secrets-manager/sdks/c-sharp.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "C++",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/cpp",
        image: "../../../../../../../images/secrets-manager/sdks/c-plus-plus.png",
        type: IntegrationType.SDK,
      },
      {
        name: "Go",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/go",
        image: "../../../../../../../images/secrets-manager/sdks/go.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "Java",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/java",
        image: "../../../../../../../images/secrets-manager/sdks/java.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/sdks/java-white.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "JS WebAssembly",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/js",
        image: "../../../../../../../images/secrets-manager/sdks/wasm.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "php",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/php",
        image: "../../../../../../../images/secrets-manager/sdks/php.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "Python",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/python",
        image: "../../../../../../../images/secrets-manager/sdks/python.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "Ruby",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/ruby",
        image: "../../../../../../../images/secrets-manager/sdks/ruby.png",
        type: IntegrationType.SDK,
      },
      {
        name: "Kubernetes Operator",
        linkURL: "https://bitwarden.com/help/secrets-manager-kubernetes-operator/",
        image: "../../../../../../../images/secrets-manager/integrations/kubernetes.svg",
        type: IntegrationType.Integration,
        newBadgeExpiration: "2024-8-12",
      },
      {
        name: "Terraform Provider",
        linkURL: "https://registry.terraform.io/providers/bitwarden/bitwarden-secrets/latest",
        image: "../../../../../../../images/secrets-manager/integrations/terraform.svg",
        type: IntegrationType.Integration,
        newBadgeExpiration: "2025-12-12", // December 12, 2025
      },
    ];

    this.state.setIntegrations(integrations);
  }

  get integrations(): Signal<Integration[]> {
    return this.state.integrations;
  }

  // use in the view
  get IntegrationType(): typeof IntegrationType {
    return IntegrationType;
  }
}
