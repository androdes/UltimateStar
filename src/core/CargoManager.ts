import {PublicKey} from "@solana/web3.js";
import {CargoPod, CargoStatsDefinition, CargoType} from "@staratlas/cargo";
import {getCargoPodsByAuthority} from "@staratlas/sage";

import {readAllFromRPC} from "@staratlas/data-source";
import {getConnection, CARGO_PROGRAM} from "./Globals.ts";




export async function getCargoPodByAuthority(authority: PublicKey): Promise<CargoPod> {
    const cargoPods = (await getCargoPodsByAuthority(
        await getConnection(),
        CARGO_PROGRAM,
        authority
    )).filter(p => p.type === 'ok')
        .map(x => (x as any).data as CargoPod);
    if (cargoPods.length > 1) throw "Too many cargo pods. Please clean them up.";
    if (cargoPods.length === 0) {
        console.log("Default cargo POD UST-CSS !!");
        return JSON.parse('{"_data":{"version":0,"statsDefinition":"cstath6RrYbzZcW5HUVgkE2ibC3JS8g56YsfXVeNNR6","authority":"GXTrjTnA4kRtsQ2HsVyzSPSKf3jidb66vvXJM97yJ8Lq","openTokenAccounts":22,"podSeeds":[113,154,37,109,32,176,32,108,122,25,2,98,167,210,217,172,192,197,224,162,140,82,227,202,176,88,86,48,33,22,146,58],"podBump":254,"seqId":1,"unupdatedTokenAccounts":0},"_key":"YLDNhVCX64CmSTrc5SQsKVhR8nBvW5AM3p69B928Ygq","_stats":["0babe4"]}');
    }
    return cargoPods[0];
}
let cargoStatsDef:CargoStatsDefinition;
export const getCargoStatsDefinition = async ()=> {
    if(cargoStatsDef){
        return cargoStatsDef
    }

    const cargoStats =(await readAllFromRPC(
        await getConnection(),
        CARGO_PROGRAM,
        CargoStatsDefinition))
        .filter(p => p.type === 'ok')
        .map(x => (x as any).data as CargoStatsDefinition);

    if(cargoStats.length > 1){
        throw "Too many cargoStats";
    }
    if(cargoStats.length === 0){
        throw "No cargoStats";
    }
    return cargoStatsDef=cargoStats[0];
}

 export const getCargoTypeAddress = async (mint: PublicKey) => {
    // console.log("Load cargoStats");
    const cargoStatsDefinition= await getCargoStatsDefinition();
    //console.log(`Cargo stats: ${JSON.stringify(cargoStatsDefinition)}`);
    const seqId = cargoStatsDefinition.data.seqId as Number;
    return CargoType.findAddress(
        CARGO_PROGRAM,
        cargoStatsDefinition.key,
        mint,
        seqId
    );
}