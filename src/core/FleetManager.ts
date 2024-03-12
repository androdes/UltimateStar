import {
    createAssociatedTokenAccountIdempotent,
    getParsedTokenAccountsByOwner,
    InstructionReturn,
    readFromRPCOrError,
    stringToByteArray
} from "@staratlas/data-source";
import {
    betterGetTokenAccountsByOwner,
    CargoStats,
    DepositCargoToFleetInput,
    Fleet, FleetStateData,
    getOrCreateAssociatedTokenAccount,
    LoadingBayToIdleInput,
    MineItem,
    Resource, ScanForSurveyDataUnitsInput,
    StarbasePlayer,
    StartMiningAsteroidInput,
    StartSubwarpInput, SurveyDataUnitTracker,
    WarpToCoordinateInput
} from "@staratlas/sage";
import {GAME_ID, SAGE_RESOURCES_MINTS, SDU_TRACKER} from "../common/Constants.ts";
import {
    getConnection,
    SAGE_PROGRAM,
    PLAYER_PROFILE_KEY,
    PROFILE_FACTION_KEY,
    prepareTransaction, executeTransaction, GAME, verifyTransaction, CARGO_PROGRAM, waitForState
} from "./Globals.ts";
import {ComputeBudgetProgram, PublicKey} from "@solana/web3.js";
import {Account, getAssociatedTokenAddress, getAssociatedTokenAddressSync} from "@solana/spl-token";
import {BN} from "@project-serum/anchor";
import {WithdrawCargoFromFleetInput} from "@staratlas/sage/dist/src/constants";
import {StopMiningAsteroidInput} from "@staratlas/sage/src/constants.ts";
import {NoEnoughRepairKits} from "../common/errors.ts";

import {signer, wallet} from "./Wallet.ts";
import {
    getStarbaseAccount,
    getStarbaseAddress,
    getStarbasePlayerAccount,
    getStarbasePlayerAddress
} from "./StarbaseManager.ts";
import {getCargoStatsDefinition, getCargoTypeAddress, getCargoPodByAuthority} from "./CargoManager.ts";
import {PLANET_LOOKUP} from "./PlanetManager.ts";


const addPriorityFee: InstructionReturn = (x) => {
    return new Promise((resolve, reject) => {
        try {
            const instruction = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 17000 });
            resolve({ instruction, signers: [] });  // Resolve the promise with the result
        } catch (error) {
            reject(error);  // Reject the promise if an error occurs
        }
    });
};



const getFleetAddress = (fleetName: string) => {
    const fleetLabel = stringToByteArray(fleetName, 32);
    const [fleet] = Fleet.findAddress(
        SAGE_PROGRAM,
        GAME_ID,
        PLAYER_PROFILE_KEY,
        fleetLabel
    );
    return fleet;
}

const fleetAccountCache = {};
export const getFleetAccount = async (fleetName: string, force:boolean=false) => {
    const fleetPubkey = getFleetAddress(fleetName);
    // Vérifier si le résultat est déjà dans le cache
    if (fleetAccountCache[fleetName] && !force) {
        return fleetAccountCache[fleetName];
    }
    let fleet: Fleet;
    try{
        fleet = await readFromRPCOrError(
            getConnection(),
            SAGE_PROGRAM,
            fleetPubkey,
            Fleet,
            "confirmed"
        );
    }catch(e){
        console.log("Failed to fetch account");
        return null;
    }

    fleetAccountCache[fleetName] = fleet;
    return fleet;
};

export const dockToStarbase = async (fleetName: string, starbaseName: string) => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    const starbaseKey: PublicKey = getStarbaseAddress(starbaseName);
    const starbasePlayerKey = await getStarbasePlayerAddress(starbaseName);
    const gameState = GAME.data.gameState as PublicKey;
    const input = 0 as LoadingBayToIdleInput;
    const ix = [];
    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await Fleet.idleToLoadingBay(
        SAGE_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        fleetAccount.key,
        starbaseKey,
        starbasePlayerKey,
        GAME_ID,
        gameState,
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared `);
    let rx= await executeTransaction(tx);
    if (!rx.value.isOk()) {
        throw Error(`${fleetName} failed to dock to starbase`);
    }
    console.log(`${fleetName} docked!`);


};

export const undockFromStarbase = async (fleetName: string, starbaseName: string) =>{
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    const starbaseKey: PublicKey = getStarbaseAddress(starbaseName);
    const starbasePlayerKey = await getStarbasePlayerAddress(starbaseName);

    const gameState = GAME.data.gameState as PublicKey;
    const input = 0 as LoadingBayToIdleInput;
    const ix =[];
    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await Fleet.loadingBayToIdle(
        SAGE_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        fleetAccount.key,
        starbaseKey,
        starbasePlayerKey,
        GAME_ID,
        gameState,
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared undock`);
    try {
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} can't undock from ${starbaseName} `);
        }
        console.log(`${fleetName} undocked from ${starbaseName}!`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
        }
    }
}

export const exitSubwarp = async (fleetName: string)=>{
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    const gameState = GAME.data.gameState as PublicKey;
    const fuelMint = GAME.data.mints.fuel;
    const fuelTank = fleetAccount.data.fuelTank as PublicKey;
    const [fuelCargoType] = await getCargoTypeAddress(fuelMint);
    const tokenMint = fuelMint;
    const tokenFrom = await getAssociatedTokenAddress(
        tokenMint,
        fuelTank,
        true
    );
    const cargoStatsDefinition = await getCargoStatsDefinition();
    const ix = [];
    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await Fleet.movementSubwarpHandler(
        SAGE_PROGRAM,
        CARGO_PROGRAM,
        PLAYER_PROFILE_KEY,
        fleetAccount.key,
        fuelTank,
        fuelCargoType,
        cargoStatsDefinition.key,
        tokenFrom,
        tokenMint,
        GAME_ID,
        gameState
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared `);
    let rx= await executeTransaction(tx);
    if (!rx.value.isOk()) {
        throw Error(`${fleetName} failed to dock to starbase`);
    }
    console.log(`${fleetName} exited subwarp!`);

}





export const withdrawFromFleet = async (fleetName: string, resource: string, amount: number, starbaseName: string) =>{
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    const starbaseKey: PublicKey = getStarbaseAddress(starbaseName);
    const starbasePlayerKey = await getStarbasePlayerAddress(starbaseName);
    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const cargoTypes = await getCargoTypeAddress(SAGE_RESOURCES_MINTS[resource]);
    const [cargoType] = cargoTypes;
    const cargoPods = await getCargoPodByAuthority(await getStarbasePlayerAddress(starbaseName));
    const cargoStatsDefinition = await getCargoStatsDefinition();
    let fleetCargoHoldsPubkey;
    switch(resource){
        case "fuel": fleetCargoHoldsPubkey = fleetAccount.data.fuelTank;
            break;
        case "ammo": fleetCargoHoldsPubkey = fleetAccount.data.ammoBank;
            break;
        default: fleetCargoHoldsPubkey = fleetAccount.data.cargoHold;
            break;
    }
    const starbaseCargoHold = starbaseAccount.data.cargoHold as PublicKey;
    const fleetTokenAccounts: Account[] = await getParsedTokenAccountsByOwner(getConnection(), fleetCargoHoldsPubkey);
    //console.log(`fleetTokenAccounts ${fleetTokenAccounts.length}`);
    const tokenAccountFrom = fleetTokenAccounts.find((tokenAccount) => {
            return tokenAccount.mint.toBase58() === SAGE_RESOURCES_MINTS[resource].toBase58()
        }
    );
    if(!tokenAccountFrom || !tokenAccountFrom.address){
        throw `Withdraw ${fleetName} ${resource} tokenAccountFrom is empty`;
    }
    const starbaseTokenAccounts: Account[] =  await betterGetTokenAccountsByOwner(getConnection(), cargoPods.key);
    let tokenAccountTo = starbaseTokenAccounts.find((tokenAccount) => {
        return tokenAccount.mint.toBase58() === SAGE_RESOURCES_MINTS[resource].toBase58()
    });
    const ix = [];
    if(!tokenAccountTo || !tokenAccountTo.address){

        const mintToken = SAGE_RESOURCES_MINTS[resource];
        const someCargoAccount = await getOrCreateAssociatedTokenAccount(
            getConnection(),
            mintToken,
            cargoPods.key,
            true,
        );
        if (someCargoAccount.instructions != null) {
            ix.push(someCargoAccount.instructions);
            tokenAccountTo = someCargoAccount;
        }
    }
    const gameState =GAME.data.gameState as PublicKey;
    let amountBN = BN.min(new BN(amount), new BN(tokenAccountFrom?.amount));
    const input = { keyIndex: 0, amount: amountBN } as WithdrawCargoFromFleetInput;
    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await Fleet.withdrawCargoFromFleet(
        SAGE_PROGRAM,
        CARGO_PROGRAM,
        signer,
        wallet.publicKey,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        starbaseKey,
        starbasePlayerKey,
        fleetAccount.key,
        fleetCargoHoldsPubkey,
        cargoPods.key,
        cargoType,
        cargoStatsDefinition.key,
        tokenAccountFrom?.address,
        tokenAccountTo?.address,
        SAGE_RESOURCES_MINTS[resource],
        GAME_ID,
        gameState,
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared withdraw`);
    try {
        let rx = await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} failed to withdraw ${resource}`);
        }
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            if(!(await verifyTransaction(e.signature))){
                throw e;
            }
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
        }
    }
    console.log(`${fleetName} withdrawn ${amountBN} ${resource} !`);

}



export const depositCargoToFleet = async (fleetName: string, resource: string, amount: number, starbaseName: string) => {
    const ix: InstructionReturn[] = [];
    const fleetPubkey = getFleetAddress(fleetName);
    if (amount < 0) throw new Error("Amount can't be negative");

    // Fleet data
    const fleetAccount = await getFleetAccount(fleetName, true);
    const fleetCargoStats = fleetAccount.data.stats.cargoStats as CargoStats;

    if (!fleetAccount.state.StarbaseLoadingBay)
        throw new Error("Fleet is not at starbase loading bay");

    // Player Profile
    const playerProfilePubkey = fleetAccount.data.ownerProfile;
    const sagePlayerProfilePubkey = PLAYER_PROFILE_KEY;
    const profileFactionPubkey = PROFILE_FACTION_KEY;

    if (!sagePlayerProfilePubkey)
        throw new Error("Sage Player Profile not found");

    // Starbase where the fleet is located
    const starbasePubkey = await getStarbaseAddress(starbaseName);
    const starbaseAccount = await getStarbaseAccount(starbaseName);

    // PDA Starbase - Player
    const starbasePlayerPubkey = await getStarbasePlayerAddress(starbaseName) as PublicKey;
    const starbasePlayerAccount = await getStarbasePlayerAccount(starbasePlayerPubkey);
    const cargoPod =await getCargoPodByAuthority(await getStarbasePlayerAddress(starbaseName));
    const cargoStatsDefinition = await getCargoStatsDefinition();
    //console.log(`starbasePlayerCargoPodsAccount =${JSON.stringify(starbasePlayerCargoPodsAccount)}`);
    const tokenAccountFrom = (await betterGetTokenAccountsByOwner(getConnection(), cargoPod.key as PublicKey))
        .find((tokenAccount) => tokenAccount.mint.toBase58() === SAGE_RESOURCES_MINTS[resource].toBase58());

    if (!tokenAccountFrom){
        console.error(`Starbase player cargo pod token account not found for ${resource}`);
        return;
    }
    const tokenAccountFromPubkey = tokenAccountFrom.address;

    // This PDA account is the owner of all the resources in the fleet's cargo (Fleet Cargo Holds - Stiva della flotta)
    let fleetCargoHoldsPubkey;
    let cargoCapacity;
    switch(resource){
        case "fuel": fleetCargoHoldsPubkey = fleetAccount.data.fuelTank;
            cargoCapacity = fleetCargoStats.fuelCapacity;
            break;
        case "ammo": fleetCargoHoldsPubkey = fleetAccount.data.ammoBank;
            cargoCapacity = fleetCargoStats.ammoCapacity;
            break;
        default: fleetCargoHoldsPubkey = fleetAccount.data.cargoHold;
            cargoCapacity = fleetCargoStats.cargoCapacity;
            break;
    }

    const tokenAccountTo = (
        await getParsedTokenAccountsByOwner(
            getConnection(),
            fleetCargoHoldsPubkey
        )
    ).find(
        (tokenAccount) => tokenAccount.mint.toBase58() === SAGE_RESOURCES_MINTS[resource].toBase58()
    );
    const tokenAccountToATA = createAssociatedTokenAccountIdempotent(
        SAGE_RESOURCES_MINTS[resource],
        fleetCargoHoldsPubkey,
        true
    );
    const tokenAccountToPubkey = tokenAccountToATA.address;

    const ix_0 = tokenAccountToATA.instructions;

    ix.push(ix_0);

    //topup explicit amount
    if(tokenAccountTo && amount<999999){
        const alreadyIn = Number(tokenAccountTo.amount);
        amount = amount - alreadyIn;
        if(amount<=0){
            console.error(`${fleetName} a déjà le cargo rempli`);
            return;
        }
    }

    // amount > fleet free capacity?
    let amountBN = BN.min(new BN(amount), tokenAccountTo ? new BN(cargoCapacity).sub(new BN(tokenAccountTo.amount))
        : new BN(cargoCapacity)
    );
    console.log(`${fleetName} Amount deposit: ${amountBN} starbase amount is ${tokenAccountFrom.amount} delegated amount: ${tokenAccountFrom.delegatedAmount}` );
    // amount > starbase amount?
    amountBN = BN.min(amountBN, new BN(tokenAccountFrom.amount));
    if (amountBN <= 0){
        console.log(`${fleetName} Amount BN: ${amountBN} canceling`)
        return;
    }

    console.log(`${fleetName} Tying to add ${amountBN}`);


    const gameId = GAME_ID;
    const gameState = GAME.data.gameState
    const input = { keyIndex: 0, amount: amountBN } as DepositCargoToFleetInput;
    const [cargoType] =await getCargoTypeAddress(SAGE_RESOURCES_MINTS[resource]);

    const priority = [addPriorityFee];
    ix.push(...priority);

    ix.push( Fleet.depositCargoToFleet(
        SAGE_PROGRAM,
        CARGO_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        wallet.publicKey,
        starbasePubkey,
        starbasePlayerPubkey,
        fleetPubkey,
        cargoPod.key,
        fleetCargoHoldsPubkey,
        cargoType,
        cargoStatsDefinition.key,
        tokenAccountFromPubkey,
        tokenAccountToPubkey,
        SAGE_RESOURCES_MINTS[resource],
        gameId,
        gameState,
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared deposit`);
    try {
        let rx = await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`Failed to deposit ${resource} to ${fleetName}`);
        }
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
        }
    }
    console.log(`Deposited ${amountBN} ${resource} to ${fleetName} cargo!`);
}

export const startMining = async (fleetName: string, ore: string, starbaseName: string, timeToWait: number) => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    const starbaseKey: PublicKey = getStarbaseAddress(starbaseName);
    const starbasePlayerKey = await getStarbasePlayerAddress(starbaseName);
    const starbaseAccount = await getStarbaseAccount(starbaseName);

    const planet = PLANET_LOOKUP[starbaseAccount.data.sector as [BN, BN]];
    //console.log(`planet ${planet}`);
    const [mineItem] = MineItem.findAddress(SAGE_PROGRAM, GAME_ID, SAGE_RESOURCES_MINTS[ore]);
    const [resource] = Resource.findAddress(SAGE_PROGRAM, mineItem, planet);

    //console.log(`resource ${resource}`)

    const gameState =GAME.data.gameState as PublicKey;
    const input = { keyIndex: 0 } as StartMiningAsteroidInput;
    const ix = [];
    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await Fleet.startMiningAsteroid(
        SAGE_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        fleetAccount.key,
        starbaseKey,
        starbasePlayerKey,
        mineItem,
        resource,
        planet,
        gameState,
        GAME_ID,
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared mining`);
    try {
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} Failed to mine ${ore} `);
        }else{
            console.log(`${fleetName} started mining! Waiting for ${timeToWait} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, timeToWait * 1000));
        }
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            console.log(`${JSON.stringify(e)}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e}`);
        }
    }


}

export const stopMining = async (fleetName: string, ore: string, starbaseName: string) => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    const starbaseKey: PublicKey = getStarbaseAddress(starbaseName);
    const starbasePlayerKey = await getStarbasePlayerAddress(starbaseName);
    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const planet = PLANET_LOOKUP[starbaseAccount.data.sector as [BN, BN]];
    //console.log(`planet ${planet}`);
    const [mineItem] = MineItem.findAddress(SAGE_PROGRAM, GAME_ID, SAGE_RESOURCES_MINTS[ore]);
    const [resource] = Resource.findAddress(SAGE_PROGRAM, mineItem, planet);
    const cargoHold = fleetAccount.data.cargoHold as PublicKey;
    const fleetAmmoBank = fleetAccount.data.ammoBank as PublicKey;
    const fleetFuelTank = fleetAccount.data.fuelTank as PublicKey;
    const [foodCargoType] =await getCargoTypeAddress(SAGE_RESOURCES_MINTS["food"]);
    const [fuelCargoType] =await getCargoTypeAddress(SAGE_RESOURCES_MINTS["fuel"]);
    const [ammoCargoType] =await getCargoTypeAddress(SAGE_RESOURCES_MINTS["ammo"]);
    const [resourceCargoType] =await getCargoTypeAddress(SAGE_RESOURCES_MINTS[ore]);
    const cargoStatsDefinition = await getCargoStatsDefinition();
    const gameState =GAME.data.gameState as PublicKey;

    const fleetFoodToken = await getAssociatedTokenAddress(
        SAGE_RESOURCES_MINTS["food"],
        cargoHold,
        true
    );
    const fleetAmmoToken = await getAssociatedTokenAddress(
        SAGE_RESOURCES_MINTS["ammo"],
        fleetAmmoBank,
        true
    );
    const fleetFuelToken = await getAssociatedTokenAddress(
        SAGE_RESOURCES_MINTS["fuel"],
        fleetFuelTank,
        true
    );
    const resourceTokenFrom = await getAssociatedTokenAddress(
        SAGE_RESOURCES_MINTS[ore],
        mineItem,
        true
    );
    let ix =[];
    let ataResourceTokenTo = createAssociatedTokenAccountIdempotent(
        SAGE_RESOURCES_MINTS[ore],
        cargoHold,
        true
    );

    const resourceTokenTo = ataResourceTokenTo.address;
    ix.push(ataResourceTokenTo.instructions);
    const priority = [addPriorityFee];
    ix.push(...priority);
    let tx1 = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared ATA resource token`);
    try {
        let rx1= await executeTransaction(tx1);
        if (!rx1.value.isOk()) {
            throw Error(`${fleetName} Failed to create ATA`);
            return;
        }
        console.log(`${fleetName} created ATA!`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            console.log(`${JSON.stringify(e)}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e}`);
            return;
        }
    }
    ix =[];
    ix.push(...priority);

    ix.push(
        await Fleet.asteroidMiningHandler(
            SAGE_PROGRAM,
            CARGO_PROGRAM,
            PROFILE_FACTION_KEY,
            fleetAccount.key,
            starbaseKey,
            mineItem,
            resource,
            planet,
            cargoHold,
            fleetAmmoBank,
            foodCargoType,
            ammoCargoType,
            resourceCargoType,
            cargoStatsDefinition.key,
            gameState,
            GAME_ID,
            fleetFoodToken,
            fleetAmmoToken,
            resourceTokenFrom,
            resourceTokenTo,
            SAGE_RESOURCES_MINTS["food"],
            SAGE_RESOURCES_MINTS["ammo"]
        ));
    //console.log("asteroidMiningHandler ok");
    const input = { keyIndex: 0 } as StopMiningAsteroidInput;
    const resourceKey = fleetAccount.state.MineAsteroid?.resource as PublicKey;

    ix.push(await Fleet.stopMiningAsteroid(
        SAGE_PROGRAM,
        CARGO_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        fleetAccount.key,
        resourceKey,
        planet,
        fleetFuelTank,
        fuelCargoType,
        cargoStatsDefinition.key,
        gameState,
        GAME_ID,
        fleetFuelToken,
        SAGE_RESOURCES_MINTS["fuel"],
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared stop mining`);
    try {
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} Failed to stop mining ${ore} `);
        }
        console.log(`${fleetName} stopped mining ${ore}!`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            console.log(`${JSON.stringify(e)}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e}`);
        }
    }

}

export const subwarp = async (fleetName: string, toStarbaseName: string|[number, number]) => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    let coordinates;
    let starbaseAccount;
    if((typeof toStarbaseName === 'string')){
        starbaseAccount = await getStarbaseAccount(toStarbaseName);
        coordinates = starbaseAccount.data.sector as [BN, BN];
    }else{
        coordinates = [new BN(toStarbaseName[0]), new BN(toStarbaseName[1])];
    }
    const gameState =GAME.data.gameState as PublicKey;
    const input = {
        keyIndex: 0, // FIXME: This is the index of the wallet used to sign the transaction in the permissions list of the player profile being used.
        toSector: coordinates,
    } as StartSubwarpInput;
    const ix = [];
    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await Fleet.startSubwarp(
        SAGE_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        fleetAccount.key,
        GAME_ID,
        gameState,
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared subwarp to ${toStarbaseName}`);
    try {
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} Failed to subwarp to ${toStarbaseName} `);
        }
        console.log(`${fleetName} starts subwarp !`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            console.log(`${JSON.stringify(e)}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e}`);
            throw e;
        }
    }
    console.log(`${fleetName} Subwarp started!`);
    const subwarpTime = await getSubwarpTimeToSleep(fleetName);
    await waitForState(fleetName, subwarpTime);
}

export const onSubwarpSleep= async (fleetName: string) =>{
    const fleetAccount = await getFleetAccount(fleetName, true);
    if(fleetAccount.state.MoveSubwarp){
        const arrivalTime = fleetAccount.state.MoveSubwarp.arrivalTime as number;
        const currentTime = Math.floor(Date.now() / 1000);
        const timeDifference = arrivalTime - currentTime;
        await waitForState(fleetName, timeDifference);
    }

}

export const onWarpSleep= async (fleetName: string) =>{
    const fleetAccount = await getFleetAccount(fleetName, true);
    if(fleetAccount.state.MoveWarp){
        const arrivalTime = fleetAccount.state.MoveWarp.warpFinish as number;
        console.log(`State ${JSON.stringify(fleetAccount.state)}`);
        const currentTime = Math.floor(Date.now() / 1000);
        const timeDifference = arrivalTime - currentTime;
        await waitForState(fleetName, timeDifference);
    }

}

export const warp = async (fleetName: string, toStarbaseName: string|[number, number]) => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    let coordinates;
    if(typeof toStarbaseName === 'string'){
        const starbaseAccount = await getStarbaseAccount(toStarbaseName);
        coordinates = starbaseAccount.data.sector as [BN, BN]
    }else{
        coordinates = [new BN(toStarbaseName[0]), new BN(toStarbaseName[1])];
    }

    const [fuelCargoType] = await getCargoTypeAddress(SAGE_RESOURCES_MINTS["fuel"]);
    const gameFuelMint = GAME.data.mints.fuel as PublicKey;
    const tokenFrom = await getAssociatedTokenAddress(gameFuelMint,fleetAccount.data.fuelTank as PublicKey,true);
    const cargoStatsDefinition =await getCargoStatsDefinition();
    const gameState =GAME.data.gameState as PublicKey;
    const input = {
        keyIndex: 0, // FIXME: This is the index of the wallet used to sign the transaction in the permissions list of the player profile being used.
        toSector: coordinates,
    } as WarpToCoordinateInput;
    const ix = [];

    const priority = [addPriorityFee];
    ix.push(...priority);

    ix.push(await Fleet.warpToCoordinate(
        SAGE_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        fleetAccount.key,
        fleetAccount.data.fuelTank,
        fuelCargoType,
        cargoStatsDefinition.key,
        tokenFrom,
        gameFuelMint,
        gameState,
        GAME_ID,
        CARGO_PROGRAM,
        input
    ));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} tx prepared warp to ${toStarbaseName}`);
    try {
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} Failed to warp to ${toStarbaseName} `);
        }
        console.log(`${fleetName} starts warp !`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            console.log(`${JSON.stringify(e)}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e}`);
            throw e;
        }
    }
    console.log(`${fleetName} Subwarp started!`);
}



export const scan = async (fleetName: string) => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    //console.log(`Account ${JSON.stringify(fleetAccount)}`);
    const [sduCargoType] = await getCargoTypeAddress(SAGE_RESOURCES_MINTS["sdu"]);
    //console.log(`cargoType ${JSON.stringify(sduCargoType)}`);
    const repairKitMint = GAME.data.mints.repairKit as PublicKey;
    const [repairKitCargoType] =await getCargoTypeAddress(repairKitMint);
    const gameState =GAME.data.gameState as PublicKey;
    const [signerAddress] = SurveyDataUnitTracker.findSignerAddress(
        SAGE_PROGRAM,
        SDU_TRACKER
    );
    const sduTokenFrom = getAssociatedTokenAddressSync(
        SAGE_RESOURCES_MINTS["sdu"],
        signerAddress,
        true
    );

    const sduTokenTo = await getOrCreateAssociatedTokenAccount(
        getConnection(),
        SAGE_RESOURCES_MINTS["sdu"],
        fleetAccount.data.cargoHold as PublicKey,
        true
    );
    let ix =[];
    let tx;
    if(sduTokenTo.instructions){
        const priorityx = [addPriorityFee];
        ix.push(...priorityx);
        ix.push(sduTokenTo.instructions);
        tx = await prepareTransaction(ix);
        console.log(`${fleetName} sdu token account to create`);
        try {
            let rx= await executeTransaction(tx);
            if (!rx.value.isOk()) {
                throw Error(`${fleetName} Failed create to sdu token account  `);
            }
            console.log(`${fleetName} created sdu token account !`);

        }catch (e) {

            if (e && e.signature) {
                console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
                console.log(`${JSON.stringify(e)}`);
                await verifyTransaction(e.signature, true);
            } else {
                console.error(`Erreur sans signature de transaction : ${e}`);
                throw e;
            }
        }
    }

    const repairKitTokenFrom = getAssociatedTokenAddressSync(
        repairKitMint,
        fleetAccount.data.cargoHold as PublicKey,
        true
    );
    const cargoStatsDefinition =await getCargoStatsDefinition();
    if (!repairKitTokenFrom) throw new NoEnoughRepairKits("NoEnoughRepairKits");
    const input = { keyIndex: 0 } as ScanForSurveyDataUnitsInput;
    ix=[];

    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await SurveyDataUnitTracker.scanForSurveyDataUnits(
        SAGE_PROGRAM,
        CARGO_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        fleetAccount.key,
        SDU_TRACKER,
        fleetAccount.data.cargoHold,
        sduCargoType,
        repairKitCargoType,
        cargoStatsDefinition.key,
        sduTokenFrom,
        sduTokenTo.address,
        repairKitTokenFrom,
        repairKitMint,
        GAME_ID,
        gameState,
        input
    ));

    tx = await prepareTransaction(ix);
    //console.log(`${fleetName} scan start`);
    try {
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} Failed to scan  `);
        }
        return rx.value;
        console.log(`${fleetName} Scan complete !`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            console.log(`${JSON.stringify(e)}`);
            return await verifyTransaction(e.signature, true);
        } else {
            console.error(`Erreur sans signature de transaction : ${e}`);
            throw e;
        }
    }
}

export const exitWarp = async (fleetName: string) =>{
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    const ix: InstructionReturn[] = [];
    const priority = [addPriorityFee];
    ix.push(...priority);
    ix.push(await Fleet.moveWarpHandler(SAGE_PROGRAM, fleetAccount.key));
    let tx = await prepareTransaction(ix);
    console.log(`${fleetName} exit warp start`);
    try {
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${fleetName} Failed to exit warp  `);
        }
        console.log(`${fleetName} exit warp complete !`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            console.log(`${JSON.stringify(e)}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e}`);
            throw e;
        }
    }
}

export const getFleetResourceAmount = async (fleetName: string, resource: string)=>{
    //console.log(`getFleetResourceAmount ${fleetName} ${resource}`)
    const fleetAccount: Fleet = await getFleetAccount(fleetName);
    let fleetTankPubkey;
    switch(resource){
        case "fuel": fleetTankPubkey = fleetAccount.data.fuelTank;
            break;
        case "ammo": fleetTankPubkey = fleetAccount.data.ammoBank;
            break;
        default: fleetTankPubkey = fleetAccount.data.cargoHold;
            break;
    }
    const tokenAccountFrom = (
        await getParsedTokenAccountsByOwner(
            getConnection(),
            fleetTankPubkey
        )
    ).find((tokenAccount) =>{
        return tokenAccount && tokenAccount.mint.toBase58() === SAGE_RESOURCES_MINTS[resource].toBase58()
    });
    if(!tokenAccountFrom){
        return 0;
    }
    return Math.floor(Number(tokenAccountFrom.amount));
}

export const getFleetState= async (fleetName: string):Promise<FleetStateData> => {
    //console.log(`getFleetState ${fleetName}`);
    const fleetAccount: Fleet = await getFleetAccount(fleetName, true);
    return fleetAccount.state;
}

export const canExitSubwarp = async(fleetName: string, destination?: [number, number]): Promise<boolean> => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName, true);
    if (!fleetAccount.state.MoveSubwarp || !fleetAccount.state.MoveSubwarp.arrivalTime) {
        return false;
    }
    const arrivalTime = fleetAccount.state.MoveSubwarp.arrivalTime as number; // Assurez-vous que c'est en secondes
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = arrivalTime - currentTime;

    // Convertir la différence en heures, minutes, secondes
    const hours = Math.floor(timeDifference / 3600);
    const minutes = Math.floor((timeDifference % 3600) / 60);
    const seconds = timeDifference % 60;

    return timeDifference<0;


}

const getSubwarpTimeToSleep = async (fleetName: string) => {
    const fleetAccount = await getFleetAccount(fleetName, true);
    const arrivalTime = fleetAccount.state.MoveSubwarp.arrivalTime as number; // Assurez-vous que c'est en secondes
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = arrivalTime - currentTime;
    return timeDifference;
}

export const canExitWarp = async(fleetName: string, destination?: [number, number]): Promise<boolean> => {
    const fleetAccount: Fleet = await getFleetAccount(fleetName, true);
    if (!fleetAccount.state.MoveWarp || !fleetAccount.state.MoveWarp.warpFinish) {
        return false;
    }
    const currentTime = Math.floor(Date.now() / 1000);
    return (currentTime >= fleetAccount.state.MoveWarp.warpFinish as number) as boolean;
}

export const getFleetCargoAvailable = async(fleetName: string) => {
    const fleetAccount = await getFleetAccount(fleetName, true);
    const fleetCargoStats = fleetAccount.data.stats.cargoStats as CargoStats;
    let freeSpace = new BN(fleetCargoStats.cargoCapacity);
    const fleetCargoHoldsPubkey = fleetAccount.data.cargoHold;
    const tokenAccounts =   await getParsedTokenAccountsByOwner(getConnection(), fleetCargoHoldsPubkey);
    const tokenAccount = (
        await getParsedTokenAccountsByOwner(getConnection(), fleetAccount.data.cargoHold)
    );
    for(const tokenAccount of tokenAccounts){
        freeSpace = new BN(freeSpace).sub(
            new BN(tokenAccount.amount)
        );
    }
    return freeSpace;
}

export const isFleetAtCoordinates = async (fleetName: string, position: [number, number]|string) => {
    const fleetAccount = await getFleetAccount(fleetName, true);
    //console.log(`${position} Type of position ${typeof position}`)
    if(typeof position==='string'){
        if(fleetAccount.state.StarbaseLoadingBay){
            const starbaseAccount = await getStarbaseAccount(position);
            console.log(`Starbase : ${starbaseAccount.key} Fleet: ${fleetAccount.state.StarbaseLoadingBay.starbase}`);
            return starbaseAccount.key.toString()===fleetAccount.state.StarbaseLoadingBay.starbase.toString()
        }
    }
    if(fleetAccount.state.Idle){
        const sector = [Number(fleetAccount.state.Idle.sector[0]), Number(fleetAccount.state.Idle.sector[1])];
        console.log(`${fleetName} Is at ${JSON.stringify(sector)}`);

        return sector[0] === ( position[0] as number ) && sector[1] === (position[1] as number);
    }

    return false;
}

export const getFleetStateAsString= async (fleetName: string) =>{
    if(await isIdle(fleetName)){
        return 'Idle';
    }
    if(await isStarbaseLoadingBay(fleetName)){
        return 'StarbaseLoadingBay';
    }
    if(await isMineAsteroid(fleetName)){
        return 'MineAsteroid';
    }
    if(await isMoveWarp(fleetName)){
        return 'MoveWarp';
    }
    if(await isMoveSubwarp(fleetName)){
        return 'MoveSubwarp';
    }
    if(await isRespawn(fleetName)){
        return 'Respawn';
    }
    return 'Unknown';
}
export const  isIdle = async (fleetName: string) => {
    const state = await getFleetState(fleetName);
    return 'Idle' in state;
}

export const  isStarbaseLoadingBay = async (fleetName: string) => {
    const state = await getFleetState(fleetName);
    return 'StarbaseLoadingBay' in state;
}

export const isMineAsteroid = async (fleetName: string) => {
    const state = await getFleetState(fleetName);
    return 'MineAsteroid' in state;
}

export const isMoveWarp=  async (fleetName: string) => {
    const state = await getFleetState(fleetName);
    return 'MoveWarp' in state;
}

export const isMoveSubwarp= async (fleetName: string) => {
    const state = await getFleetState(fleetName);
    return 'MoveSubwarp' in state;
}

export const isRespawn = async (fleetName: string) => {
    const state = await getFleetState(fleetName);
    return 'Respawn' in state;
}