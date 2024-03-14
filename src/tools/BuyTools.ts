import {depositIntoGame, exchangeOrderBuy, exchangeOrderSell} from "../core/GalaxyClient.ts";
import {SAGE_RESOURCES_MINTS} from "../common/Constants.ts";
import {
    dockToStarbase,
    exitWarp,
    onWarpSleep,
    stopSubwarp,
    subwarp,
    warp,
    withdrawFromFleet
} from "../core/FleetManager.ts";
import {disbandedFleetDataEquals} from "@staratlas/sage";
import {waitForState} from "../core/Globals.ts";


//await exchangeOrderBuy(SAGE_RESOURCES_MINTS["tool"], 50000);
//await dockToStarbase("PICO", "UST-CSS");
//await withdrawFromFleet("FIBO", "sdu", 470, "UST-CSS");
//await exitWarp("CALI");
//await exitWarp("FIBO");
//await depositIntoGame(SAGE_RESOURCES_MINTS["tool"], 50000);
async function warpTo(fleetName, coordinates:[number, number]){
    await warp(fleetName, coordinates);
    await onWarpSleep(fleetName);
    await waitForState(fleetName, 3);
    await exitWarp(fleetName);
}
