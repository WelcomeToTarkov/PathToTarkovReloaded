const LOCATIONS_MAPS: Record<string, string> = {
  bigmap: "bigmap",
  factory4_day: "factory4_day",
  factory4_night: "factory4_night",
  rezervbase: "rezervbase",
  interchange: "interchange",
  woods: "woods",
  lighthouse: "lighthouse",
  shoreline: "shoreline",
  laboratory: "laboratory",
  tarkovstreets: "tarkovstreets",
  sandbox: "sandbox",
};

export const resolveMapNameFromLocation = (location: string): string => {
  const locationName = location.toLowerCase();
  const mapName = LOCATIONS_MAPS[locationName];

  return mapName ?? "";
};
