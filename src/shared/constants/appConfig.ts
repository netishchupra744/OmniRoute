import pkg from "../../../package.json" with { type: "json" };

export const APP_CONFIG = {
  name: "Bijoy AI Video Maker",
  description: "API-based 33-scene AI video production studio",
  version: pkg.version,
};

export const THEME_CONFIG = {
  storageKey: "theme",
  defaultTheme: "system",
};
