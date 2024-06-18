import type { DependencyContainer } from "tsyringe";

import type { PreAkiModLoader } from "@spt-aki/loaders/PreAkiModLoader";
import type { IPostAkiLoadMod } from "@spt-aki/models/external/IPostAkiLoadMod";
import type { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { ConfigServer } from "@spt-aki/servers/ConfigServer";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { StaticRouterModService } from "@spt-aki/services/mod/staticRouter/StaticRouterModService";

import { createPathToTarkovAPI } from "./api";
import type { Config, SpawnConfig } from "./config";
import { CONFIG_PATH, PACKAGE_JSON_PATH, SPAWN_CONFIG_PATH } from "./config";
import { EventWatcher } from "./event-watcher";
import { createStaticRoutePeeker } from "./helpers";
import { enableKeepFoundInRaidTweak } from "./keep-fir-tweak";

import { PathToTarkovController } from "./path-to-tarkov-controller";
import { purgeProfiles } from "./uninstall";
import type { PackageJson } from "./utils";
import { getModDisplayName, noop, readJsonFile } from "./utils";
import { EndOfRaidController } from "./end-of-raid-controller";

class PathToTarkov implements IPreAkiLoadMod, IPostAkiLoadMod {
  private packageJson: PackageJson;
  private config: Config;
  private spawnConfig: SpawnConfig;

  public logger: ILogger;
  public debug: (data: string) => void;
  public container: DependencyContainer;
  public executeOnStartAPICallbacks: (sessionId: string) => void = noop;
  public pathToTarkovController: PathToTarkovController;

  public preAkiLoad(container: DependencyContainer): void {
    this.container = container;
    this.packageJson = readJsonFile(PACKAGE_JSON_PATH);
    this.config = readJsonFile(CONFIG_PATH);
    this.spawnConfig = readJsonFile(SPAWN_CONFIG_PATH);

    this.logger = container.resolve<ILogger>("WinstonLogger");
    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true)
      : noop;

    if (this.config.debug) {
      this.debug("debug mode enabled");
    }

    const db = container.resolve<DatabaseServer>("DatabaseServer");
    const configServer = container.resolve<ConfigServer>("ConfigServer");
    const modLoader = container.resolve<PreAkiModLoader>("PreAkiModLoader");
    const saveServer = container.resolve<SaveServer>("SaveServer");

    const staticRouter = container.resolve<StaticRouterModService>(
      "StaticRouterModService"
    );

    if (!this.config.enabled) {
      this.logger.warning("=> Path To Tarkov is disabled!");

      if (this.config.bypass_uninstall_procedure === true) {
        this.logger.warning(
          "=> PathToTarkov: uninstall process aborted because 'bypass_uninstall_procedure' field is true in config.json"
        );
        return;
      }

      purgeProfiles(this.config, saveServer, this.logger);
      return;
    }

    const tweakFoundInRaid = !this.config.bypass_keep_found_in_raid_tweak;

    if (tweakFoundInRaid) {
      enableKeepFoundInRaidTweak(this);
      this.debug("option keep_found_in_raid_tweak enabled");
    }

    // TODO: compat with Custom Quests
    const getIsTraderLocked = () => false;

    this.pathToTarkovController = new PathToTarkovController(
      this.config,
      this.spawnConfig,
      db,
      saveServer,
      configServer,
      getIsTraderLocked,
      this.logger,
      this.debug,
      createStaticRoutePeeker(staticRouter),
      modLoader
    );

    this.pathToTarkovController.hijackLuasCustomSpawnPointsUpdate();

    const eventWatcher = new EventWatcher(this);
    const endOfRaidController = new EndOfRaidController(this);

    eventWatcher.onEndOfRaid((payload) => endOfRaidController.end(payload));
    eventWatcher.register(createStaticRoutePeeker(staticRouter));

    this.logger.info(
      `===> Loading ${getModDisplayName(this.packageJson, true)}`
    );
  }
  private modConfig = require("../config/Tooltips.json");
  
  public postAkiLoad(container: DependencyContainer): void {
    this.container = container;

    if (!this.config.enabled) {
      return;
    }

    this.pathToTarkovController.generateEntrypoints();

    const [api, executeOnStartAPICallbacks] = createPathToTarkovAPI(
      this.pathToTarkovController
    );

    (globalThis as any).PathToTarkovAPI = api;

    this.executeOnStartAPICallbacks = executeOnStartAPICallbacks;

    this.pathToTarkovController.initExfiltrations();
    this.pathToTarkovController.fixInsuranceDialogues();

    if (this.config.traders_access_restriction) {
      this.pathToTarkovController.tradersController.initTraders();
    }

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`
    );

     // get database from server
     const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");

     // Get all the in-memory json found in /assets/database
     const database = databaseServer.getTables();
     const enLocales = database.locales.global.en;
     const localesToChange = this.modConfig.localesToChange;
     const localesToChangeAdditional =this.modConfig.localesToChangeAdditional;
     const additionalLocalesToggle = this.modConfig.additionalLocalesToggle;
     const moddedTraderExtracts = this.modConfig.moddedTraderExtracts;
     const moddedTraderCompat = this.modConfig.moddedTraderCompat;
            
     for (let i = 0; i < localesToChange.length; i += 2){
         enLocales[localesToChange[i]] = localesToChange[i+1];
     }
     if (additionalLocalesToggle){
         for (let i = 0; i < localesToChangeAdditional.length; i += 2){
             enLocales[localesToChangeAdditional[i]] = localesToChangeAdditional [i+1];
         }
     }
     if (moddedTraderCompat){
         for (let i = 0; i < moddedTraderExtracts.length; i += 2){
             enLocales[moddedTraderExtracts[i]] = moddedTraderExtracts [i+1];
         }
     }
  }
}

module.exports = { mod: new PathToTarkov() };
