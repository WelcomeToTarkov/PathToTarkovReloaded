const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(
  __dirname,
  "../../../../Aki_Data/Server/database/"
);
const TARGET_PATH = path.resolve(__dirname, "../external-resources/");
const MAPS_PATH = path.join(TARGET_PATH, "maps");

if (!fs.existsSync(TARGET_PATH)) fs.mkdirSync(TARGET_PATH, { recursive: true });
if (!fs.existsSync(MAPS_PATH)) fs.mkdirSync(MAPS_PATH, { recursive: true });

const copyFile = (src, dest) => {
  fs.copyFileSync(path.join(DB_PATH, src), path.join(TARGET_PATH, dest));
};

copyFile("locales/global/en.json", "locales_global_en.json");

const maps = [
  { src: "locations/bigmap/base.json", dest: "maps/customs.json" },
  { src: "locations/factory4_day/base.json", dest: "maps/factory.json" },
  { src: "locations/interchange/base.json", dest: "maps/interchange.json" },
  { src: "locations/laboratory/base.json", dest: "maps/laboratory.json" },
  { src: "locations/lighthouse/base.json", dest: "maps/lighthouse.json" },
  { src: "locations/rezervbase/base.json", dest: "maps/reserve.json" },
  { src: "locations/shoreline/base.json", dest: "maps/shoreline.json" },
  { src: "locations/woods/base.json", dest: "maps/woods.json" },
  { src: "locations/tarkovstreets/base.json", dest: "maps/streets.json" },
  { src: "locations/sandbox/base.json", dest: "maps/sandbox.json" },
];

maps.forEach(({ src, dest }) => copyFile(src, dest));

console.log("External resources gathered successfully.");
