import type { Disc } from "./types";
import type { DiscInput } from "./validation";

// Prepare an editable draft; moving isn't persisted until the owner saves it.
export function prepareLocationChange(
  disc: Disc,
  location: DiscInput["location"],
  date: string,
): Disc {
  return {
    ...disc,
    location,
    locationDetail: "",
    lostAt: location === "Lost" ? date : null,
  };
}
