import {StarbaseCoordinates} from "../common/Starbases.ts";
import {getOrCreateAssociatedTokenAccount, Starbase, StarbasePlayer} from "@staratlas/sage";
import {GAME_ID, SAGE_RESOURCES_MINTS} from "../common/Constants.ts";
import {readFromRPCOrError} from "@staratlas/data-source";
import {PublicKey} from "@solana/web3.js";
import {getConnection, SAGE_PLAYER_PROFILE, SAGE_PROGRAM} from "./Globals.ts";
import {getAccount} from "@solana/spl-token";
import {getCargoPodByAuthority} from "./CargoManager.ts";


const starbaseCache = {};
const starbaseAccountCache ={};
const starbasePlayerAddressCache = {};
const starbasePlayerAccountCache = {};
export const getStarbaseAddress = (starbase: string) => {
    if(starbaseCache[StarbaseCoordinates[starbase]]){
        return starbaseCache[StarbaseCoordinates[starbase]];
    }
    const [starbaseAddress] = Starbase.findAddress(
        SAGE_PROGRAM,
        GAME_ID,
        StarbaseCoordinates[starbase]
    );
    starbaseCache[StarbaseCoordinates[starbase]] = starbaseAddress;
    return starbaseAddress;
}

export const getStarbaseAccount = async (starbaseName: string, force=false): Promise<Starbase> =>{
    if(starbaseAccountCache[starbaseName] && !force){
        return starbaseAccountCache[starbaseName];
    }
    const starbasePubkey = getStarbaseAddress(starbaseName);
    starbaseAccountCache[starbaseName] = await readFromRPCOrError(
        getConnection(),
        SAGE_PROGRAM,
        starbasePubkey,
        Starbase,
        "confirmed"
    );
    return starbaseAccountCache[starbaseName];
}

export const getStarbasePlayerAddress = async (starbaseName: string): Promise<PublicKey> => {
    if(starbasePlayerAddressCache[starbaseName]){
        return starbasePlayerAddressCache[starbaseName];
    }
    const starbaseKey = getStarbaseAddress(starbaseName);
    const starbaseAccount: Starbase = await getStarbaseAccount(starbaseName);
    const seqId = starbaseAccount.data.seqId as Number;
    const [starbasePlayer] = StarbasePlayer.findAddress(
        SAGE_PROGRAM,
        starbaseKey,
        SAGE_PLAYER_PROFILE,
        seqId
    );
    starbasePlayerAddressCache[starbaseName]=starbasePlayer as PublicKey;
    return starbasePlayerAddressCache[starbaseName];
}

export const getStarbasePlayerAccount = async(starbasePlayerPubkey: PublicKey): Promise<StarbasePlayer>=>{
    if(starbasePlayerAccountCache[starbasePlayerPubkey.toString()]){
        return starbasePlayerAccountCache[starbasePlayerPubkey.toString()];
    }
    starbasePlayerAccountCache[starbasePlayerPubkey.toString()]=(await readFromRPCOrError(
        getConnection(),
        SAGE_PROGRAM,
        starbasePlayerPubkey,
        StarbasePlayer,
        "confirmed"
    ));
    return starbasePlayerAccountCache[starbasePlayerPubkey.toString()] as StarbasePlayer;
}

export const getStarbaseResourceAmount = async (starbaseName: string, resource: string) =>{
    console.log(`Looking for resource ${resource} in ${starbaseName}`)
    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const starbasePlayerPubkey = await getStarbasePlayerAddress(starbaseName);
    const cargoPod = await getCargoPodByAuthority(starbasePlayerPubkey);
    const starbasePlayerCargoPodsPubkey = cargoPod.key;//new PublicKey("YLDNhVCX64CmSTrc5SQsKVhR8nBvW5AM3p69B928Ygq");
    const mintToken = SAGE_RESOURCES_MINTS[resource];
    const someCargoAccount = await getOrCreateAssociatedTokenAccount(
        getConnection(),
        mintToken,
        starbasePlayerCargoPodsPubkey,
        true,
    );
    const Ix= [];
    if (someCargoAccount.instructions != null) {
        return 0;
    }
    else {
        return Number((await getAccount(
            getConnection(),
            someCargoAccount.address,
            'confirmed',
        )).delegatedAmount);
    }
}

export const getStarbaseAmountByMint = async (starbaseName: string, mint: string) =>{

    const starbaseAccount = await getStarbaseAccount(starbaseName);

    // PDA Starbase - Player
    const starbasePlayerPubkey = await getStarbasePlayerAddress(starbaseAccount.data.starbasePlayer);
    const cargoPod = await getCargoPodByAuthority(starbasePlayerPubkey);
    const starbasePlayerCargoPodsPubkey = cargoPod.key;
    const mintToken = new PublicKey(mint);
    const someCargoAccount = await getOrCreateAssociatedTokenAccount(
        getConnection(),
        mintToken,
        starbasePlayerCargoPodsPubkey,
        true,
    );
    const Ix= [];
    if (someCargoAccount.instructions != null) {
        return 0;
    }
    else {
        return Number((await getAccount(
            getConnection(),
            someCargoAccount.address,
            'confirmed',
        )).delegatedAmount);
    }
}