// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("node:fs/promises");

const EXTERNAL_RESOURCES_DIR = "external-resources";
const LOCATION_NAME_MAPPING_FILENAME = "location_name_mapping.json";
const LOCALES_FILENAME = "locales_global_en.json";
const SCAVS_EXFILS_FILENAME = "scavs_exfils.json";
const MAPGENIE_LOCATIONS_FILENAME = "mapgenie_locations.json";
const MAPS_DIR = "maps";

const MARKDOWN_MAIN_TITLE = "All exfiltrations";

const MARKDOWN_TABLE_HEADER = `
|identifier|description|mapgenie.io|
|----------|-----------|-----------|
`.trim();

const MAPGENIE_REMAPPING = {
  laboratory: "lab",
};

const lowerLocaleKeys = (locales) => {
  const result = {};
  const localeKeys = Object.keys(locales);

  localeKeys.forEach((localeKey) => {
    result[localeKey.toLowerCase()] = locales[localeKey];
  });

  if (Object.keys(result).length < localeKeys.length) {
    console.warn(
      "Warning: some locales has been lost during key lower casing!"
    );
  }

  return result;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOCATION_NAME_MAPPING = require(`../${EXTERNAL_RESOURCES_DIR}/${LOCATION_NAME_MAPPING_FILENAME}`);
const LOCALES = lowerLocaleKeys(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(`../${EXTERNAL_RESOURCES_DIR}/${LOCALES_FILENAME}`)
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SCAVS_EXFILS = require(`../${EXTERNAL_RESOURCES_DIR}/${SCAVS_EXFILS_FILENAME}`);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MAPGENIE_LOCATIONS = require(`../${EXTERNAL_RESOURCES_DIR}/${MAPGENIE_LOCATIONS_FILENAME}`);

const getMapJsonFilePath = (mapName) =>
  `${EXTERNAL_RESOURCES_DIR}/${MAPS_DIR}/${mapName}.json`;

const getMapGenieMapName = (mapName) => {
  if (MAPGENIE_REMAPPING[mapName]) {
    return MAPGENIE_REMAPPING[mapName];
  }

  return mapName;
};

const resolveMapGenieLocationId = (mapName, exitResolvedName) => {
  const mapLocations = MAPGENIE_LOCATIONS[mapName];

  if (!mapLocations) {
    console.error(
      `Error: map name '${mapName}' does not exist in MAPGENIE_LOCATIONS`
    );
    return null;
  }

  const mapLocation = mapLocations.find(
    (l) => l.description.toLowerCase() === exitResolvedName.toLowerCase()
  );

  if (!mapLocation) {
    console.error(
      `Warning: cannot resolve map location ${exitResolvedName} for map '${mapName}'`
    );
    return null;
  }

  return mapLocation.id;
};

const getMapGenieLocationUrl = (mapName, locationId) => {
  const mapGenieMapName = getMapGenieMapName(mapName);
  return `[link](https://mapgenie.io/tarkov/maps/${mapGenieMapName}?locationIds=${locationId})`;
};

class ConfigError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "Configuration Error";
  }
}

const resolveMapDisplayName = (mapName) => LOCATION_NAME_MAPPING[mapName];

const assertValidMapNames = (mapNames) => {
  mapNames.forEach((mapName) => {
    if (!LOCATION_NAME_MAPPING[mapName]) {
      throw new ConfigError(
        `Invalid map name '${mapName}' found in ${SCAVS_EXFILS_FILENAME} file!`
      );
    }
  });
};

const resolveLocale = (localeId) => {
  const value = LOCALES[localeId.toLowerCase()];

  if (!value) {
    throw new ConfigError(`Cannot resolve locale from '${localeId}' key`);
  }

  return value;
};

const loadMapExits = async (mapName) => {
  const filePath = getMapJsonFilePath(mapName);

  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContent).exits.map((exit) => exit.Name);
  } catch (err) {
    throw new ConfigError(
      `cannot load '${filePath}, reason=${err.toString()}'`
    );
  }
};

const loadMapsExits = async (allMapNames) => {
  const result = {};

  for (const mapName of allMapNames) {
    const mapExits = await loadMapExits(mapName);
    result[mapName] = mapExits;
  }

  return result;
};

const simpleDedup = (array) => {
  const resultObj = {};

  array.forEach((elem) => {
    resultObj[elem] = true;
  });

  return Object.keys(resultObj);
};

const mergeMapsExits = (mapsExitsLeft, mapsExitsRight) => {
  const result = {};

  const mapNames = Object.keys({ ...mapsExitsLeft, ...mapsExitsRight });

  for (const mapName of mapNames) {
    const exitsLeft = mapsExitsLeft[mapName] || [];
    const exitsRight = mapsExitsRight[mapName] || [];
    const allExits = simpleDedup([...exitsLeft, ...exitsRight]);

    result[mapName] = allExits;
  }

  return result;
};

const formatMapsExits = (mapsExits) => {
  const allMapNames = Object.keys(mapsExits);
  assertValidMapNames(allMapNames);

  return allMapNames
    .reduce((output, mapName) => {
      const title = `## ${resolveMapDisplayName(mapName)}`;
      const exits = mapsExits[mapName];

      const formattedRow = exits
        .map((exitName) => {
          const resolvedExitName = resolveLocale(exitName);
          const mapGenieLocationId = resolveMapGenieLocationId(
            mapName,
            resolvedExitName
          );

          if (!mapGenieLocationId) {
            return "";
          }

          const mapGenieLocationUrl = getMapGenieLocationUrl(
            mapName,
            mapGenieLocationId
          );

          return `| "${exitName}" | ${resolveLocale(
            exitName
          )} | ${mapGenieLocationUrl} |`;
        })
        .filter(Boolean);

      return (
        output +
        `${title}\n${MARKDOWN_TABLE_HEADER}\n${formattedRow.join("\n")}\n\n`
      );
    }, "")
    .trim();
};

const main = async () => {
  const allMapNames = Object.keys(SCAVS_EXFILS);
  assertValidMapNames(allMapNames);

  const mapsExits = await loadMapsExits(allMapNames);
  const allMapsExits = mergeMapsExits(mapsExits, SCAVS_EXFILS);

  return `
# ${MARKDOWN_MAIN_TITLE}
${formatMapsExits(allMapsExits)}
  `;
};

main()
  .then((result) => {
    process.stdout.write(result);
    process.stdout.write("\n");
  })
  .catch((err) => {
    if (err instanceof ConfigError) {
      console.error(err.toString());
    } else {
      console.error(err);
    }
  });
