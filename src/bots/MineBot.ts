import {
    depositCargoToFleet,
    dockToStarbase,
    getFleetResourceAmount,
    getFleetState,
    isIdle, isMineAsteroid,
    isStarbaseLoadingBay,
    startMining, stopMining, undockFromStarbase, withdrawFromFleet
} from "../core/FleetManager.ts";
import {sleep, waitForState} from "../core/Globals.ts";

export async function run(bot: any) {
    console.log(`Starting script for ${bot.name}`);
    const sstate = await getFleetState(bot.name);
    console.log(`State is ${JSON.stringify(sstate)}`);
    while (true) {
        console.log("Loop");
        const state = await getFleetState(bot.name);
        const foodAmount =  await getFleetResourceAmount(bot.name, "food");
        const fuelAmount =  await getFleetResourceAmount(bot.name, "fuel");
        const resourceAmount = await getFleetResourceAmount(bot.name, bot.resource);

        console.log(`Food: ${foodAmount} Fuel: ${fuelAmount} ${bot.resource}: ${resourceAmount}`);
        if(await isIdle(bot.name)){
            if(foodAmount===bot.foodReloadAmount){
                await startMining(bot.name, bot.resource, bot.starbase, bot.miningTime);
            }else{
                await dockToStarbase(bot.name, bot.starbase);
            }
        }
        if(await isStarbaseLoadingBay(bot.name)){
            if(resourceAmount>0){
                await withdrawFromFleet(bot.name, bot.resource, 999999, bot.starbase);
            }
            if(fuelAmount<=bot.minFuel){
                console.log("Deposit fuel");
                await depositCargoToFleet(bot.name, "fuel", 999999, bot.starbase);
            }
            if(foodAmount<bot.foodReloadAmount){
                console.log(`Deposit food ${bot.foodReloadAmount-foodAmount}`);
                await depositCargoToFleet(bot.name, "food", bot.foodReloadAmount, bot.starbase);
            }
            if(foodAmount===bot.foodReloadAmount && resourceAmount===0){
                await undockFromStarbase(bot.name, bot.starbase);
            }
        }
        if(await isMineAsteroid(bot.name)) {
            const startTime = state.MineAsteroid?.start as number;
            const currentTime = Math.floor(Date.now() / 1000);
            const timeDifference = currentTime - startTime;
            console.log(`Mining remaining time: ${bot.miningTime - timeDifference}`);
            if (bot.miningTime - timeDifference<0 || timeDifference < bot.miningTime) {
                await waitForState(bot.name, bot.miningTime - timeDifference);
                await stopMining(bot.name, bot.resource, bot.starbase);
                console.log("Wait for state change");
                await waitForState(bot.name, 3);
            }
        }
    }
}