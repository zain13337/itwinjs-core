/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import {KnownLocations as PlatformKnownLocations} from "../backend/KnownLocations";

export class KnownTestLocations {

  /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
  public static get assetsDir(): string {
    const imodeljsMobile = PlatformKnownLocations.imodeljsMobile;
    if (imodeljsMobile !== undefined) {
      return imodeljsMobile.knownLocations. ;
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "assets");
  }

  /** The directory where tests can write. */
  public static get outputDir(): string {
    const imodeljsMobile = PlatformKnownLocations.imodeljsMobile;
    if (imodeljsMobile !== undefined) {
      return imodeljsMobile.knownLocations.tempDir;
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "output");
  }

}
