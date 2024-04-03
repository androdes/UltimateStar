import {depositIntoGame, exchangeOrderBuy, exchangeOrderSell} from "../core/GalaxyClient.ts";
import {SAGE_RESOURCES_MINTS} from "../common/Constants.ts";
import {
    depositCargoToFleet,
    dockToStarbase, exitSubwarp,
    exitWarp, onSubwarpSleep,
    onWarpSleep, stopMining,
    stopSubwarp,
    subwarp, undockFromStarbase,
    warp,
    withdrawFromFleet
} from "../core/FleetManager.ts";
import {disbandedFleetDataEquals} from "@staratlas/sage";
import {getSimulationUnits, waitForState} from "../core/Globals.ts";

//await exchangeOrderSell(SAGE_RESOURCES_MINTS["sdu"], 344);
//await exchangeOrderBuy(SAGE_RESOURCES_MINTS["fuel"], 20000);
//await dockToStarbase("HYDRO", "UST-CSS");
//await withdrawFromFleet("FIBO", "sdu", 470, "UST-CSS");
//await exitWarp("CALI");
//await stopMining("HYDRO", "hydrogen", "UST-CSS");
//
//await depositIntoGame(SAGE_RESOURCES_MINTS["tool"], 50000);
async function warpTo(coordinates:[number, number],fleetName = "CALI"){
    await warp(fleetName, coordinates);
    await onWarpSleep(fleetName);
    await waitForState(fleetName, 3);
    await exitWarp(fleetName);
}

async function subwarpTo(coordinates:[number, number],fleetName = "CALI" ){
    await subwarp(fleetName, coordinates);
    await onSubwarpSleep(fleetName);
    await waitForState(fleetName, 3);
    await exitSubwarp(fleetName);
}
//await stopSubwarp("CALI");

//await subwarpTo("CALI", [33,16])

//await undockFromStarbase("CALI", "UST-CSS");

//await dockToStarbase("CALI", "UST-CSS");
//await depositCargoToFleet("CALI", "fuel", 999999, "UST-CSS");
//await undockFromStarbase("CALI", "MRZ-23");
//await subwarpTo("CALI", [40,30])
//await withdrawFromFleet("CALI", "iron_ore", 11167, "UST-CSS");
//await depositCargoToFleet("CALI", "fuel", 999999, "UST-CSS");
//await depositCargoToFleet("CALI", "copper_ore", 10911, "MRZ-23");
//await depositCargoToFleet("CALI", "iron_ore", 11167, "MRZ-23");
//await depositCargoToFleet("CALI", "crystallattice", 50, "MRZ-23");
//
// await depositCargoToFleet("CALI", "steel", 90, "MRZ-23");
//await depositCargoToFleet("CALI", "carbon", 100, "MRZ-23");
//await depositCargoToFleet("CALI", "electromagnet", 145, "MRZ-23");
//await depositCargoToFleet("CALI", "magnet", 305, "MRZ-23");
//await depositCargoToFleet("CALI", "copperwire", 500, "MRZ-23");

//await exitWarp("CALI");
//await subwarpTo( [22,21])
//await exitWarp("CALI");

//await undockFromStarbase("CALI", "UST-CSS");
//await subwarpTo("CALI", [44,10])
//await subwarpTo([42,35]);
//await stopSubwarp("CALI");
//await exitSubwarp("CALI");
//await dockToStarbase("HYDRO", "UST-CSS");
await dockToStarbase("HYDRO",  "UST-CSS");