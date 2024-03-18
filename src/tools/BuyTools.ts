import {depositIntoGame, exchangeOrderBuy, exchangeOrderSell} from "../core/GalaxyClient.ts";
import {SAGE_RESOURCES_MINTS} from "../common/Constants.ts";
import {
    dockToStarbase, exitSubwarp,
    exitWarp, onSubwarpSleep,
    onWarpSleep, stopMining,
    stopSubwarp,
    subwarp,
    warp,
    withdrawFromFleet
} from "../core/FleetManager.ts";
import {disbandedFleetDataEquals} from "@staratlas/sage";
import {waitForState} from "../core/Globals.ts";

//await exchangeOrderSell(SAGE_RESOURCES_MINTS["sdu"], 344);
//await exchangeOrderBuy(SAGE_RESOURCES_MINTS["fuel"], 20000);
//await dockToStarbase("HYDRO", "UST-CSS");
//await withdrawFromFleet("FIBO", "sdu", 470, "UST-CSS");
//await exitWarp("CALI");
//await stopMining("HYDRO", "hydrogen", "UST-CSS");
//await exitWarp("FIBO");
//await depositIntoGame(SAGE_RESOURCES_MINTS["tool"], 50000);
async function warpTo(fleetName, coordinates:[number, number]){
    await warp(fleetName, coordinates);
    await onWarpSleep(fleetName);
    await waitForState(fleetName, 3);
    await exitWarp(fleetName);
}

async function subwarpTo(fleetName, coordinates:[number, number]){
    await subwarp(fleetName, coordinates);
    await onSubwarpSleep(fleetName);
    await waitForState(fleetName, 3);
    await exitSubwarp(fleetName);
}
//await stopSubwarp("HYDRO");
await warpTo("CALI", [18,22])
//await warpTo("CALI", [21,17])

