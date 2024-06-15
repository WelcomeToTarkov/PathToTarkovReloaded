import type { StaticRoutePeeker } from "./helpers";
import type { EndOfRaidPayload, PTTInstance } from "./end-of-raid-controller";

type EndOfRaidCallback = (payload: EndOfRaidPayload) => void;

type RaidCache = {
  saved: boolean;
  endOfRaid: boolean;
  sessionId: string | null;
  currentLocationName: string | null;
  exitName: string | null | undefined;
  isPlayerScav: boolean | null;
};

const getEmptyRaidCache = (): RaidCache => ({
  saved: false,
  endOfRaid: false,
  sessionId: null,
  currentLocationName: null,
  exitName: undefined,
  isPlayerScav: null,
});

export class EventWatcher {
  private raidCaches: Record<string, RaidCache> = {};
  private endOfRaidCallback: EndOfRaidCallback | null = null;

  constructor(private ptt: PTTInstance) {}

  private cleanRaidCache(sessionId: string): void {
    this.raidCaches[sessionId] = getEmptyRaidCache();
  }

  private initRaidCache(sessionId: string): void {
    this.cleanRaidCache(sessionId);
    this.raidCaches[sessionId].sessionId = sessionId;
  }

  private getRaidCache(sessionId: string): RaidCache {
    if (!this.raidCaches[sessionId]) {
      this.initRaidCache(sessionId);
    }
    return this.raidCaches[sessionId];
  }

  private watchOnGameStart(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/game/start",
      (url, info: unknown, sessionId) => {
        this.initRaidCache(sessionId);

        if (
          !this.ptt.pathToTarkovController.stashController.getInventory(
            sessionId
          )
        ) {
          this.ptt.debug(
            `/client/game/start: no pmc data found, init will be handled on profile creation`
          );
          // no pmc data found, init will be handled by `watchOnProfileCreated`
          return;
        }

        this.ptt.pathToTarkovController.init(sessionId);
        this.ptt.executeOnStartAPICallbacks(sessionId);

        this.ptt.logger.info(`=> PathToTarkov: game started!`);
      }
    );
  }

  private watchOnProfileCreated(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/game/profile/create",
      (url, info: unknown, sessionId) => {
        this.initRaidCache(sessionId);

        this.ptt.pathToTarkovController.init(sessionId);
        this.ptt.executeOnStartAPICallbacks(sessionId);

        this.ptt.logger.info(`=> PathToTarkov: pmc created!`);
      }
    );
  }

  private watchStartOfRaid(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/raid/configuration",
      (url, info: { location: string }, sessionId) => {
        const raidCache = this.getRaidCache(sessionId);
        raidCache.currentLocationName = info.location;

        this.ptt.debug(
          `offline raid started on location '${info.location}' with sessionId '${sessionId}'`
        );
      }
    );
  }

  private watchSave(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/raid/profile/save",
      (url, info: { isPlayerScav: boolean }, sessionId) => {
        const raidCache = this.getRaidCache(sessionId);
        raidCache.saved = true;
        raidCache.isPlayerScav = info.isPlayerScav;

        this.ptt.debug(
          `profile saved: raidCache.isPlayerScav=${info.isPlayerScav}`
        );

        if (!raidCache.endOfRaid) {
          this.ptt.debug("end of raid: callback execution delayed...");
          return;
        }

        return this.runEndOfRaidCallback(sessionId);
      }
    );
  }

  private watchEndOfRaid(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/match/offline/end",
      (url, info: { exitName: string | null }, sessionId: string) => {
        const raidCache = this.getRaidCache(sessionId);
        raidCache.endOfRaid = true;
        raidCache.sessionId = sessionId;
        raidCache.exitName = info.exitName;

        this.ptt.debug(`end of raid detected for exit '${info.exitName}'`);

        if (!raidCache.saved) {
          this.ptt.debug(
            "end of raid: callback execution delayed on profile save..."
          );
          return;
        }

        return this.runEndOfRaidCallback(sessionId);
      }
    );
  }

  private getEndOfRaidPayload(sessionId: string): EndOfRaidPayload {
    const raidCache = this.getRaidCache(sessionId);
    const {
      sessionId: cacheSessionId,
      currentLocationName: locationName,
      isPlayerScav,
      exitName,
    } = raidCache;

    if (cacheSessionId === null) {
      throw new Error("raidCache.sessionId is null");
    }

    if (locationName === null) {
      throw new Error("raidCache.currentLocationName is null");
    }

    if (isPlayerScav === null) {
      throw new Error("raidCache.isPlayerScav is null");
    }

    if (exitName === undefined) {
      throw new Error("raidCache.exitName is undefined");
    }

    return {
      sessionId: cacheSessionId,
      locationName,
      isPlayerScav,
      exitName,
    };
  }

  private runEndOfRaidCallback(sessionId: string): void {
    if (this.endOfRaidCallback) {
      try {
        const endOfRaidPayload = this.getEndOfRaidPayload(sessionId);
        this.endOfRaidCallback(endOfRaidPayload);
      } catch (error: any) {
        this.ptt.logger.error(`Path To Tarkov Error: ${error.message}`);
      } finally {
        this.cleanRaidCache(sessionId);
      }
    } else {
      this.ptt.logger.error(
        "Path To Tarkov Error: no endOfRaidCallback on EventWatcher!"
      );
    }
  }

  public onEndOfRaid(cb: EndOfRaidCallback): void {
    if (this.endOfRaidCallback) {
      throw new Error(
        "Path To Tarkov EventWatcher: endOfRaidCallback already set!"
      );
    }

    this.endOfRaidCallback = cb;
  }

  public register(staticRoutePeeker: StaticRoutePeeker): void {
    this.watchOnGameStart(staticRoutePeeker);
    this.watchOnProfileCreated(staticRoutePeeker);
    this.watchStartOfRaid(staticRoutePeeker);
    this.watchSave(staticRoutePeeker);
    this.watchEndOfRaid(staticRoutePeeker);

    staticRoutePeeker.register();
  }
}
