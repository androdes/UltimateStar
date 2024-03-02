import {
    canExitSubwarp,
    canExitWarp, dockToStarbase, exitSubwarp,
    exitWarp,
    getFleetResourceAmount, getFleetState, isIdle, isMoveSubwarp,
    isMoveWarp,
    isStarbaseLoadingBay, onSubwarpSleep,
    onWarpSleep, scan, subwarp, undockFromStarbase, warp, withdrawFromFleet, depositCargoToFleet
} from "../core/FleetManager.ts";

import {getTransactionDetails, waitForState} from "../core/Globals.ts";
import {getNbSDULastMinute, getNbSDULastSeconds} from "../core/SDUTracker.ts";
export async function handleWarp(bot: any) {
    if (await canExitWarp(bot.name)) {
        await exitWarp(bot.name);
    } else {
        await onWarpSleep(bot.name);
    }
}

export async function handleReload(bot: any){
    const nbSDU = await getFleetResourceAmount(bot.name, "sdu");
    const nbTool = await getFleetResourceAmount(bot.name, "tool");
    const nbFuel = await getFleetResourceAmount(bot.name, "fuel");
    if (nbSDU > 0) {
        await withdrawFromFleet(bot.name, "sdu", 999999, "UST-CSS");
    }
    if(nbSDU==0){
        if(nbFuel<bot.fullFuel){
            await depositCargoToFleet(bot.name, "fuel", bot.fullFuel, "UST-CSS");
        }
        if(nbTool !=bot.toolsReloadAmount){
            await depositCargoToFleet(bot.name, "tool", bot.toolsReloadAmount, "UST-CSS");
        }
    }
    if(nbSDU==0 && nbTool==bot.toolsReloadAmount && nbFuel==bot.fullFuel){
        await undockFromStarbase(bot.name, "UST-CSS");
    }
}

interface ExtractedData {
    Sector: string|null;
    SDUProbability: number|null;
    SDUMultiplier: string|null;
}

function extractData(logs: string[]): ExtractedData {
    let extractedData: ExtractedData = {
        Sector: null,
        SDUProbability: null,
        SDUMultiplier: null,
    };

    logs.forEach((log) => {
        if (log.includes("Sector:")) {
            extractedData.Sector = log.split(":")[2].trim();
        } else if (log.includes("SDU probability:")) {
            let probString =log.split(":")[2].trim();
            if(probString){
                extractedData.SDUProbability =parseFloat(probString);
            }

        } else if (log.includes("SDU Multiplier:")) {
            extractedData.SDUMultiplier = log.split(":")[2].trim();
        }
    });

    return extractedData;
}

let previousProbability = 0;
async function doScan(bot: any, nbToolkits: number){
    const nbScans = Math.floor(nbToolkits / bot.toolPerScan);
    for (let i = 0; i < nbScans; i++) {
        const nbSDUBefore = await getFleetResourceAmount(bot.name, "sdu") as number;
        let nbSDUCollected =1500;
        console.log("Trying to find SDU");
        //while (nbSDUCollected>0){
        //   await new Promise((resolve) => setTimeout(resolve, 0.5*1000));
        //   nbSDUCollected=await getNbSDULastSeconds(1);
        //}
        const result = await scan(bot.name);

        const nbToolkits = await getFleetResourceAmount(bot.name, "tool") as number;
        const nbSDU = await getFleetResourceAmount(bot.name, "sdu") as number;
        console.log(`Nb tools: ${nbToolkits} Nb SDU:${nbSDU}`);
        if(nbToolkits==0){
            break;
        }
        let executionTime = 0;
        let waitTime=parseInt(bot.cooldown);
        if(result.value){
            const details = await getTransactionDetails(result.value);
            if(details && details.blockTime){
                executionTime = new Date().getTime()/1000 - details?.blockTime;
            }
            if(executionTime>0){
                waitTime -= executionTime;
            }
            const extracted = extractData(details?.meta?.logMessages);

            previousProbability = extracted.SDUProbability ? extracted.SDUProbability : 0 ;
            console.log(`Result : ${JSON.stringify(extracted)}`);
        }
        if(nbSDUBefore<nbSDU){
            console.log(`Found SDU, cooling down`);
            //waitTime*=2;
        }
        console.log(`Scan Exec time ${executionTime} real cooldown ${waitTime} `);
        await waitForState(bot.name, Math.ceil(waitTime));
    }
}

export async function handleWarper(bot: any, currentSectorIndex: number, nbToolkits: number){
    let nextSector;
    if (currentSectorIndex == 0) {
        nextSector = bot.route[1];
        // @ts-ignore
        await warp(bot.name, nextSector);
        await onWarpSleep(bot.name);
        await waitForState(bot.name, bot.warpCooldown);
    } else {
        if (nbToolkits >= bot.toolPerScan) {
            if (currentSectorIndex > 0 && currentSectorIndex == bot.route.length - 1) {
                await doScan(bot, nbToolkits);
            } else {
                if (currentSectorIndex > 0 && currentSectorIndex < bot.route.length - 1) {
                    nextSector = bot.route[currentSectorIndex + 1];
                    // @ts-ignore
                    await warp(bot.name, nextSector);
                    await onWarpSleep(bot.name);
                    await waitForState(bot.name, bot.warpCooldown);
                }
            }
        } else {
            // @ts-ignore
            await warp(bot.name, bot.route[currentSectorIndex - 1]);
            await onWarpSleep(bot.name);
            await waitForState(bot.name, bot.warpCooldown);
        }

    }
}



export async function handleSubwarper(bot: any, currentIndex:number, nbToolkits: number){
    let nextSector;
    if (currentIndex == 0) {
        nextSector = bot.route[1];
        // @ts-ignore
        await subwarp(bot.name, nextSector);
        await onSubwarpSleep(bot.name);

    } else {
        if (nbToolkits >= bot.toolPerScan) {
            if (currentIndex > 0 && currentIndex == bot.route.length - 1) {
                await doScan(bot, nbToolkits);
            }
        } else {
            // @ts-ignore
            await subwarp(bot.name, bot.route[currentIndex - 1]);
            await onSubwarpSleep(bot.name);

        }

    }
}

export async function handleSubwarp(bot: any){
    if (await canExitSubwarp(bot.name)) {
        await exitSubwarp(bot.name);
    } else {
        await onSubwarpSleep(bot.name);
    }
}


export async function run(army: any){
    console.log(`Starting script for ${army.name}`);
    function getRouteIndex(state: any) {
        console.log(`${JSON.stringify( state.Idle?.sector)}`)
        const sector = [Number(state.Idle.sector[0]), Number(state.Idle.sector[1])];
        console.log(`NB sector ${JSON.stringify(sector)} |`)
        for( let i=0; i<army.route.length; i++){
            if(army.route[i][0] == sector[0] && army.route[i][1] == sector[1]){
                return i;
            }
        }
        return -1;
    }
    const sstate = await getFleetState(army.name);
    console.log(`State is ${JSON.stringify(sstate)}`);
    while (true) {
        console.log("Loop");
        const state = await getFleetState(army.name);
        if (await isIdle(army.name)) {
            const currentIndex = getRouteIndex(state);

            const nbToolkits = await getFleetResourceAmount(army.name, "tool") as number;
            const nbSDU = await getFleetResourceAmount(army.name, "sdu") as number;
            console.log(`State: Idle Nb tools: ${nbToolkits} Nb SDU:${nbSDU} routeIndex:${currentIndex}`);
            if (nbToolkits < army.toolsReloadAmount && nbSDU >= 0 && currentIndex == 0) {
                await dockToStarbase(army.name, "UST-CSS");
            } else {
                if(army.warper){
                    await handleWarper(army, currentIndex, nbToolkits);
                }else{
                    await handleSubwarper(army, currentIndex, nbToolkits)
                }
            }
        }
        if (await isStarbaseLoadingBay(army.name)) {
            await handleReload(army);
        }
        if(army.warper){
            if (await isMoveWarp(army.name)) {
                await handleWarp(army);
            }
        }else{
            if (await isMoveSubwarp(army.name)) {
                await handleSubwarp(army);
            }
        }
    }
}
