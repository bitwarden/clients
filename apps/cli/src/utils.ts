// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";
import * as path from "path";

import * as inquirer from "inquirer";
import * as JSZip from "jszip";

import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { Response } from "./models/response";
import { MessageResponse } from "./models/response/message.response";

export class CliUtils {
  static writeLn(s: string, finalLine = false, error = false) {
    const stream = error ? process.stderr : process.stdout;
    if (finalLine && (process.platform === "win32" || !stream.isTTY)) {
      stream.write(s);
    } else {
      stream.write(s + "\n");
    }
  }

  static readFile(input: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let p: string = null;
      if (input != null && input !== "") {
        const osInput = path.join(input);
        if (osInput.indexOf(path.sep) === -1) {
          p = path.join(process.cwd(), osInput);
        } else {
          p = osInput;
        }
      } else {
        reject("You must specify a file path.");
      }
      fs.readFile(p, "utf8", (err, data) => {
        if (err != null) {
          reject(err.message);
        }
        resolve(data);
      });
    });
  }

  static extractZipContent(input: string, filepath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let p: string = null;
      if (input != null && input !== "") {
        const osInput = path.join(input);
        if (osInput.indexOf(path.sep) === -1) {
          p = path.join(process.cwd(), osInput);
        } else {
          p = osInput;
        }
      } else {
        reject("You must specify a file path.");
      }
      fs.readFile(p, function (err, data) {
        if (err) {
          reject(err);
        }
        JSZip.loadAsync(data).then(
          (zip) => {
            resolve(zip.file(filepath).async("string"));
          },
          (reason) => {
            reject(reason);
          },
        );
      });
    });
  }

  /**
   * Save the given data to a file and determine the target file if necessary.
   * If output is non-empty, it is used as target filename. Otherwise the target filename is
   * built from the current working directory and the given defaultFileName.
   *
   * @param data to be written to the file.
   * @param output file to write to or empty to choose automatically.
   * @param defaultFileName to use when no explicit output filename is given.
   * @return the chosen output file.
   */
  static saveFile(data: string | Buffer, output: string, defaultFileName: string) {
    let p: string = null;
    let mkdir = false;
    if (output != null && output !== "") {
      const osOutput = path.join(output);
      if (osOutput.indexOf(path.sep) === -1) {
        p = path.join(process.cwd(), osOutput);
      } else {
        mkdir = true;
        if (osOutput.endsWith(path.sep)) {
          p = path.join(osOutput, defaultFileName);
        } else {
          p = osOutput;
        }
      }
    } else {
      p = path.join(process.cwd(), defaultFileName);
    }

    p = path.resolve(p);
    if (mkdir) {
      const dir = p.substring(0, p.lastIndexOf(path.sep));
      if (!fs.existsSync(dir)) {
        NodeUtils.mkdirpSync(dir, "700");
      }
    }

    return new Promise<string>((resolve, reject) => {
      fs.writeFile(p, data, { encoding: "utf8", mode: 0o600 }, (err) => {
        if (err != null) {
          reject("Cannot save file to " + p);
        }
        resolve(p);
      });
    });
  }

  /**
   * Process the given data and write it to a file if possible. If the user requested RAW output and
   * no output name is given, the file is directly written to stdout. The resulting Response contains
   * an otherwise empty message then to prevent writing other information to stdout.
   *
   * If an output is given or no RAW output is requested, the rules from [saveFile] apply.
   *
   * @param data to be written to the file or stdout.
   * @param output file to write to or empty to choose automatically.
   * @param defaultFileName to use when no explicit output filename is given.
   * @return an empty [Response] if written to stdout or a [Response] with the chosen output file otherwise.
   */
  static async saveResultToFile(data: string | Buffer, output: string, defaultFileName: string) {
    if ((output == null || output === "") && process.env.BW_RAW === "true") {
      // No output is given and the user expects raw output. Since the command result is about content,
      // we directly return the command result to stdout (and suppress further messages).
      process.stdout.write(data);
      return Response.success();
    }

    const filePath = await this.saveFile(data, output, defaultFileName);
    const res = new MessageResponse("Saved " + filePath, null);
    res.raw = filePath;
    return Response.success(res);
  }

  static readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      let input = "";

      if (process.stdin.isTTY) {
        resolve(input);
        return;
      }

      process.stdin.setEncoding("utf8");
      process.stdin.on("readable", () => {
        while (true) {
          const chunk = process.stdin.read();
          if (chunk == null) {
            break;
          }
          input += chunk;
        }
      });

      process.stdin.on("end", () => {
        resolve(input);
      });
    });
  }

  static searchFolders(folders: FolderView[], search: string) {
    search = search.toLowerCase();
    return folders.filter((f) => {
      if (f.name != null && f.name.toLowerCase().indexOf(search) > -1) {
        return true;
      }
      return false;
    });
  }

  static searchCollections(collections: CollectionView[], search: string) {
    search = search.toLowerCase();
    return collections.filter((c) => {
      if (c.name != null && c.name.toLowerCase().indexOf(search) > -1) {
        return true;
      }
      return false;
    });
  }

  static searchOrganizations(organizations: Organization[], search: string) {
    search = search.toLowerCase();
    return organizations.filter((o) => {
      if (o.name != null && o.name.toLowerCase().indexOf(search) > -1) {
        return true;
      }
      return false;
    });
  }

  /**
   * Gets a password from all available sources. In order of priority these are:
   *   * passwordfile
   *   * passwordenv
   *   * user interaction
   *
   * Returns password string if successful, Response if not.
   */
  static async getPassword(
    password: string,
    options: { passwordFile?: string; passwordEnv?: string },
    logService?: LogService,
  ): Promise<string | Response> {
    if (Utils.isNullOrEmpty(password)) {
      if (options?.passwordFile) {
        password = await NodeUtils.readFirstLine(options.passwordFile);
      } else if (options?.passwordEnv) {
        if (process.env[options.passwordEnv]) {
          password = process.env[options.passwordEnv];
        } else if (logService) {
          logService.warning(`Warning: Provided passwordenv ${options.passwordEnv} is not set`);
        }
      }
    }

    if (Utils.isNullOrEmpty(password)) {
      if (process.env.BW_NOINTERACTION !== "true") {
        const answer: inquirer.Answers = await inquirer.createPromptModule({
          output: process.stderr,
        })({
          type: "password",
          name: "password",
          message: "Master password:",
        });

        password = answer.password;
      } else {
        return Response.badRequest(
          "Master password is required. Try again in interactive mode or provide a password file or environment variable.",
        );
      }
    }
    return password;
  }

  static convertBooleanOption(optionValue: any) {
    return optionValue || optionValue === "" ? true : false;
  }

  static convertNumberOption(optionValue: any, defaultValue: number) {
    try {
      if (optionValue != null) {
        const numVal = parseInt(optionValue);
        return !Number.isNaN(numVal) ? numVal : defaultValue;
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static convertStringOption(optionValue: any, defaultValue: string) {
    return optionValue != null ? String(optionValue) : defaultValue;
  }
}
