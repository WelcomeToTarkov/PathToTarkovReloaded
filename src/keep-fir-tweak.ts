import type { InRaidHelper } from "@spt-aki/helpers/InRaidHelper";
import type { Item } from "@spt-aki/models/eft/common/tables/IItem";

import type { DependencyContainer } from "tsyringe";

type PTTInstance = {
  readonly container: DependencyContainer;
  readonly debug: (data: string) => void;
};

const setSpawnedInSessionOnAllItems = (items: Item[]): number => {
  let counter = 0;

  items.forEach((item) => {
    if (item.upd) {
      if (!item.upd.SpawnedInSession) {
        item.upd.SpawnedInSession = true;
        counter = counter + 1;
      }
    } else {
      item.upd = { SpawnedInSession: true };
      counter = counter + 1;
    }
  });

  return counter;
};

export const enableKeepFoundInRaidTweak = (ptt: PTTInstance): void => {
  ptt.container.afterResolution<InRaidHelper>(
    "InRaidHelper",
    (_t, result): void => {
      const inraidHelper = Array.isArray(result) ? result[0] : result;

      inraidHelper.removeSpawnedInSessionPropertyFromItems = (
        postRaidProfile
      ) => {
        const isPlayerScav = postRaidProfile.Info.Side === "Savage";
        const count = setSpawnedInSessionOnAllItems(
          postRaidProfile.Inventory.items
        );
        if (isPlayerScav) {
          ptt.debug(
            `raid ran through with a scav, added 'SpawnedInSession' flag on ${count} items`
          );
        } else {
          ptt.debug(
            `raid ran through with a pmc, added 'SpawnedInSession' flag on ${count} items`
          );
        }
        return postRaidProfile;
      };

      if ("removeFoundInRaidStatusFromItems" in inraidHelper) {
        (inraidHelper as any).removeFoundInRaidStatusFromItems =
          inraidHelper.removeSpawnedInSessionPropertyFromItems;
      }
    },
    { frequency: "Always" }
  );
};
