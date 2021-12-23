import { program } from "commander";
import execa from "execa";
import inquirer from "inquirer";
import { main } from "./main";
import path from "path";

const API_VERSION = "53.0";

export async function cli(args) {
  program
    .option("-i, --interactive", "Do you want to use interactive mode?", false)
    .option(
      "-a, --alias <alias name>",
      "What do you use for alias?If not specified, defaultusername will be used."
    )
    .option(
      "-m, --manifest <filename>",
      "What do you do with the manifest file name?",
      "package.xml"
    )
    .option(
      "-v, --apiversion <api version>",
      "What is the API version to use?",
      API_VERSION
    )
    .option(
      "-f, --infolder",
      "Do you want to include Report, Dashboard, Document, Email Template? (It may take a long time)",
      false
    )
    .option(
      "-p, --inpackage",
      "Do you want to include the package? (It may take a long time)",
      false
    );

  program.addHelpText(
    "after",
    `
EXAMPLES:
$ sfmanifest
$ sfmanifest -i
$ sfmanifest -a MyAliasName
$ sfmanifest -a MyAliasName -f -p
$ sfmanifest -a MyAliasName -m package.xml
$ sfmanifest -a MyAliasName -v ${API_VERSION}
`
  );

  program.parse(args);

  let options = program.opts();
  options.targetDirectory = process.cwd();

  if (options.interactive) {
    options = await promptForMissingOptions(options);
  }
  if (!options.alias) {
    options.alias = await getDefaultAlias(options.targetDirectory);
  }
  if (!options.alias) {
    console.error("[Error] alias is null\n");
    program.outputHelp();
    return;
  }

  options.manifestDir = path.resolve(options.targetDirectory, "./manifest");
  options.manifestFile = path.resolve(options.manifestDir, options.manifest);

  await main(options);
}

async function promptForMissingOptions(options) {
  const ret = {
    ...options,
  };

  if (!options.alias || options.alias == "Current Default Alias") {
    const aliasDefault = await getDefaultAlias(options.targetDirectory);
    if (aliasDefault) {
      ret.alias = aliasDefault;
    } else {
      const ans = await inquirer.prompt({
        type: "input",
        name: "value",
        message: "Please enter the alias you want to use.",
        default: aliasDefault,
      });
      ret.alias = ans.value;
    }
  }

  if (!options.infolder) {
    const ans = await inquirer.prompt({
      type: "confirm",
      name: "value",
      message:
        "Do you want to include Report, Dashboard, Document, Email Template? (It may take a long time)",
      default: false,
    });
    ret.infolder = ans.value;
  }

  if (!options.inpackage) {
    const ans = await inquirer.prompt({
      type: "confirm",
      name: "value",
      message: "Do you want to include the package? (It may take a long time)",
      default: false,
    });
    ret.inpackage = ans.value;
  }

  return ret;
}

async function getDefaultAlias(targetDirectory) {
  let aliasDefault = "";
  const result = await execa("sfdx ", ["config:list", "--json"], {
    cwd: targetDirectory,
  });
  const std1 = result.stdout;
  var xres = JSON.parse(std1).result;

  if (xres) {
    for (const config of xres) {
      if (config.key == "defaultusername") {
        aliasDefault = config.value;
      }
    }
  }
  return aliasDefault;
}

