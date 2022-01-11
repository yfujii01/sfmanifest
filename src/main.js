import execa from "execa";
import fs from "fs";
import xml2js from "xml2js";

const FULLNAME_COMPONENT = [
  "CustomObject",
  "CallCenter",
  "Report",
  "Dashboard",
  "Document",
  "EmailTemplate",
  "MLPredictionDefinition",
  "FieldRestrictionRule",
  "AppointmentAssignmentPolicy",
];

export async function main(options) {
  const metas = await describeMetaData(options);
  const metaTypes = await createMetaTypes(options, metas);
  await outputXml(options, metaTypes);
}

async function describeMetaData(options) {
  const execResult = await execa(
    "sfdx ",
    [
      "force:mdapi:describemetadata",
      "--targetusername",
      options.alias,
      "--json",
      "--apiversion",
      options.apiversion,
    ],
    {
      cwd: options.targetDirectory,
    }
  );

  return JSON.parse(execResult.stdout).result.metadataObjects;
}
async function createMetaTypes(options, metas) {
  const metaTypes = [];
  for (const meta of metas) {
    const metaType = await createMetaType(meta, options);
    if (metaType) {
      metaTypes.push(metaType);
    }
  }
  return metaTypes;
}

async function createMetaType(meta, options) {
  let metaType;
  if (FULLNAME_COMPONENT.includes(meta.xmlName) || options.inpackage) {
    if (meta.inFolder && options.infolder) {
      metaType = await findListMetaFolder(meta, options);
    } else {
      metaType = await findListMetaData(meta, options);
    }
  } else {
    metaType = await findListMetaWild(meta);
  }

  return metaType;
}

async function findListMetaFolder(meta, options) {
  const execResult = await execa(
    "sfdx ",
    [
      "force:mdapi:listmetadata",
      "--metadatatype",
      meta.xmlName + "Folder",
      "--targetusername",
      options.alias,
      "--json",
      "--apiversion",
      options.apiversion,
    ],
    {
      cwd: options.targetDirectory,
    }
  );

  let members = [];
  for (const member of JSON.parse(execResult.stdout).result) {
    if (member.namespacePrefix == "" || member.namespacePrefix == undefined) {
      members = members.concat(
        await findListMetaData(meta, options, member.fullName)
      );
    }
  }

  if (members.length > 0) {
    return {
      members: members,
      name: meta.xmlName,
    };
  }
}

async function findListMetaData(meta, options, folder) {
  const commandOption = [
    "force:mdapi:listmetadata",
    "--metadatatype",
    meta.xmlName,
    "--targetusername",
    options.alias,
    "--json",
    "--apiversion",
    options.apiversion,
  ];
  if (folder) {
    commandOption.push("--folder");
    commandOption.push(folder);
  }
  const execResult = await execa("sfdx ", commandOption, {
    cwd: options.targetDirectory,
  });

  const members = [];
  for (const member of JSON.parse(execResult.stdout).result) {
    if (options.inpackage) {
      members.push(member.fullName);
    } else {
      if (member.namespacePrefix == "" || member.namespacePrefix == undefined) {
        members.push(member.fullName);
      }
    }
  }

  if (folder) {
    return members;
  }

  if (members.length > 0) {
    return {
      members: members,
      name: meta.xmlName,
    };
  }
}
async function findListMetaWild(input) {
  return {
    members: "*",
    name: input.xmlName,
  };
}

async function outputXml(options, metaTypes) {
  if (!fs.existsSync(options.manifestDir)) {
    fs.mkdirSync(options.manifestDir);
  }

  const xml = new xml2js.Builder({ rootName: "Package" }).buildObject({
    types: metaTypes,
    version: options.apiversion,
  });

  fs.writeFileSync(
    options.manifestFile,
    xml.replace(
      /<Package>/,
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">'
    )
  );
}
