import { program } from "commander";

import { BaseProgram } from "./base-program";
import { ServeCommand } from "./commands/serve.command";
import { OssServeConfigurator } from "./oss-serve-configurator";
import { ServiceContainer } from "./service-container/service-container";
import { CliUtils } from "./utils";

const writeLn = CliUtils.writeLn;

export class ServeProgram extends BaseProgram {
  constructor(
    serviceContainer: ServiceContainer,
    private configurator: OssServeConfigurator,
  ) {
    super(serviceContainer);
  }

  register() {
    program
      .command("serve")
      .description("Start a RESTful API webserver.")
      .option(
        "--hostname <hostname>",
        "The hostname to bind your API webserver to. Also accepts a unix socket (`unix:///path/to.sock`) or a file descriptor (`fd+listening://<fd>`, `fd+connected://<fd>`).",
      )
      .option("--port <port>", "The port to run your API webserver on.")
      .option(
        "--disable-origin-protection",
        "If set, skips the Origin header check and the Host allowlist. Warning, this option exists for backwards compatibility reasons and exposes your environment to known CSRF attacks.",
      )
      .on("--help", () => {
        writeLn("\n  Notes:");
        writeLn("");
        writeLn("    Default hostname is `localhost`.");
        writeLn("    Use hostname `all` for no hostname binding.");
        writeLn("    Default port is `8087`.");
        writeLn(
          "    Requests are rejected unless the `Host` header matches the bound hostname and port; `all` and the socket/fd transports skip that check.",
        );
        writeLn("");
        writeLn("  Examples:");
        writeLn("");
        writeLn("    bw serve");
        writeLn("    bw serve --port 8080");
        writeLn("    bw serve --hostname bwapi.mydomain.com --port 80");
        writeLn("    bw serve --hostname unix:///run/bitwarden/bw-api.sock");
        writeLn("", true);
      })
      .action(async (cmd) => {
        await this.exitIfNotAuthed();
        const command = new ServeCommand(this.serviceContainer, this.configurator);
        await command.run(cmd);
      });
  }
}
