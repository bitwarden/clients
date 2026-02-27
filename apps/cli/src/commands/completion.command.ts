// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { program, OptionValues, Command } from "commander";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";

const validShells = ["zsh"];

export class CompletionCommand {
  async run(options: OptionValues) {
    const shell: (typeof validShells)[number] = options.shell;

    if (!shell) {
      return Response.badRequest("`shell` option was not provided.");
    }

    if (!validShells.includes(shell)) {
      return Response.badRequest("Unsupported shell.");
    }

    let content = "";

    if (shell === "zsh") {
      content = this.zshCompletion("bw", program).render();
    }

    const res = new MessageResponse(content, null);
    return Response.success(res);
  }

  private zshCompletion(rootName: string, rootCommand: Command) {
    return {
      render: () => {
        return [
          `#compdef _${rootName} ${rootName}`,
          "",
          this.renderCommandBlock(rootName, rootCommand),
        ].join("\n");
      },
    };
  }

  private renderCommandBlock(name: string, command: Command): string {
    const { commands = [], options = [] } = command;
    const hasOptions = options.length > 0;
    const hasCommands = commands.length > 0;

    const args = options
      .map(({ long, short, description }) => {
        const aliases = [short, long].filter(Boolean);
        const opts = aliases.join(",");
        const desc = `[${description.replace(`'`, `'"'"'`)}]`;
        return aliases.length > 1
          ? `'(${aliases.join(" ")})'{${opts}}'${desc}'`
          : `'${opts}${desc}'`;
      })
      .concat(
        `'(-h --help)'{-h,--help}'[output usage information]'`,
        hasCommands ? '"1: :->cmnds"' : null,
        '"*::arg:->args"',
      )
      .filter(Boolean);

    const commandBlockFunctionParts = [];

    if (hasCommands) {
      commandBlockFunctionParts.push("local -a commands");
    }

    if (hasOptions) {
      commandBlockFunctionParts.push(`_arguments -C \\\n    ${args.join(` \\\n    `)}`);
    }

    if (hasCommands) {
      commandBlockFunctionParts.push(
        `case $state in
    cmnds)
      commands=(
        ${commands
          .map((command) => `"${command.name().split(" ")[0]}:${command.description()}"`)
          .join("\n        ")}
      )
      _describe "command" commands
      ;;\n  esac

  case "$words[1]" in
    ${commands
      .map((command) => {
        const commandName = command.name().split(" ")[0];
        return [`${commandName})`, `_${name}_${commandName}`, ";;"].join("\n      ");
      })
      .join("\n    ")}\n  esac`,
      );
    }

    const commandBlocParts = [
      `function _${name} {\n  ${commandBlockFunctionParts.join("\n\n  ")}\n}`,
    ];

    if (hasCommands) {
      commandBlocParts.push(
        commands.map((c) => this.renderCommandBlock(`${name}_${c.name()}`, c)).join("\n\n"),
      );
    }

    return commandBlocParts.join("\n\n");
  }
}
