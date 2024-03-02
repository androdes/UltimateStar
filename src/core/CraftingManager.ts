import {CraftingFacility, CraftingProcess, Recipe, RecipeStatus} from "@staratlas/crafting";
import {
    byteArrayToString, createAssociatedTokenAccount,
    getParsedTokenAccountsByOwner,
    InstructionReturn,
    readAllFromRPC,
    readFromRPCOrError
} from "@staratlas/data-source";
import base58 from "bs58";

import {
    CARGO_PROGRAM,
    CRAFTING_PROGRAM, executeInstructions, GAME,
    getConnection,
    PLAYER_PROFILE_KEY,
    PROFILE_FACTION_KEY, randomUint8Arr,
    rateLimit,
    SAGE_PROGRAM
} from "./Globals.ts";
import {PublicKey} from "@solana/web3.js";
import {
    betterGetTokenAccountsByOwner,
    CraftingInstance,
    getOrCreateAssociatedTokenAccount,
    Starbase
} from "@staratlas/sage";
import {ATLAS, DECIMALS_atlas, GAME_ID} from "../common/Constants.ts";
import {BN} from "@project-serum/anchor";
import {signer, wallet} from "./Wallet.ts";
import {getStarbaseAccount, getStarbasePlayerAccount, getStarbasePlayerAddress} from "./StarbaseManager.ts";
import {Account, getAccount} from "@solana/spl-token";
import {CargoType} from "@staratlas/cargo";
import {getCargoPodByAuthority, getCargoStatsDefinition} from "./CargoManager.ts";
import {StarbaseCoordinates} from "../common/Starbases.ts";
await rateLimit();
export const RECIPES: Recipe[] = ((await readAllFromRPC(
    getConnection(),
    CRAFTING_PROGRAM,
    Recipe,
    'confirmed', [
        {
            memcmp: {
                offset: 8 + 1 + 32 + 32 + 8 + 8 + 32 + 1 + 1 + 1 + 2,
                bytes: base58.encode(Buffer.from([RecipeStatus.Active as number])),
            },
        },
    ],)).map((p) => p.type === 'ok' && p.data)) as Recipe[];
export function getRecipeNameByAddress(recipeAddress: PublicKey){
    return RECIPES.find(recipe => recipe.key.toBase58()===recipeAddress.toBase58());
}

export const getCraftingFacilityAccount = async (starbaseName:string): Promise<CraftingFacility>=>{
    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const crafingFacilityAdress = starbaseAccount.data.craftingFacility as PublicKey;
    return (await readFromRPCOrError(
        getConnection(),
        CRAFTING_PROGRAM,
        crafingFacilityAdress,
        CraftingFacility,
        'confirmed',
    )) as CraftingFacility;
}

export const getCraftingInstances = async (starbaseName: string)=>{
    const starbasePlayerPubkey = await getStarbasePlayerAddress(starbaseName) as PublicKey;
    const starbasePlayerAccount =await getStarbasePlayerAccount(starbasePlayerPubkey);
    let craftingInstance: CraftingInstance;
    let craftingInstances = (await readAllFromRPC(
        getConnection(),
        SAGE_PROGRAM,
        CraftingInstance,
        'confirmed',
        [
            {
                memcmp: {
                    offset: 8 + 1 + 2 + 8,
                    bytes: starbasePlayerAccount.key.toBase58(),
                },
            },
        ]));
    return craftingInstances.map(instance => instance.type === 'ok' && instance.data) as CraftingInstance[];
}

export const getCraftingProcessesForRecipe = async (starbaseName: string, recipe: Recipe): Promise<CraftingProcess[]> =>{
    const craftingInstances = await getCraftingInstances(starbaseName);
    const processes:CraftingProcess[] = [];
    for(let i=0; i<craftingInstances.length; i++){
        await rateLimit();
        const process = await readFromRPCOrError(
            getConnection(),
            CRAFTING_PROGRAM,
            craftingInstances[i].data.craftingProcess as PublicKey,
            CraftingProcess,
            'confirmed',
        ) as CraftingProcess;
        const processRecipeKey = process.data.recipe as PublicKey;
        if(processRecipeKey.toBase58() === recipe.key.toBase58()){
            processes.push(process);
        }
    }
    return processes;
}

export const createCraftingProcess = async (starbaseName: string, recipeName: string, quantity: number, crew: number) =>{

    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const starbasePlayerPubkey = await getStarbasePlayerAddress(starbaseName);
    const starbasePlayerAccount = await getStarbasePlayerAccount(starbasePlayerPubkey);
    const recipe = RECIPES.find(r=>byteArrayToString(r.data.namespace)===recipeName) as Recipe;
    const craftingFacilityAccount:CraftingFacility = await getCraftingFacilityAccount(starbaseName);
    const craftingProcessList:CraftingProcess[] = await getCraftingProcessesForRecipe(starbaseName, recipe);
    const existingProcessCreated = craftingProcessList.find(process=> process.data.status===1) as CraftingProcess;
    if(existingProcessCreated){
        console.warn(`There is already a process created for (${byteArrayToString(recipe.data.namespace)}`);
        // return existingProcessCreated;
        return;
    }
    const availableCrew = Number(starbasePlayerAccount.data.totalCrew) - Number(starbasePlayerAccount.data.busyCrew);
    const existingProcess = craftingProcessList.find(process=> process.data.status===2) as CraftingProcess;
    if(existingProcess){
        const currentUnixTimestamp = Date.now() / 1000 | 0;
        const ended =((Number(existingProcess.data.endTime) - currentUnixTimestamp) < 0) as boolean;
        if(existingProcess && ended){
            //Claim finished
            console.warn(`Found claimable running process for ${recipeName}`);
        }
    }
    const craftingID = new BN(randomUint8Arr());
    const categoryKey = recipe.data.category as PublicKey;
    const recipeCategoryIdx = craftingFacilityAccount.recipeCategories.findIndex(Facility => Facility.toBase58() === categoryKey.toBase58());
    const instructions=[];
    instructions.push(CraftingInstance.createCraftingProcess(
        SAGE_PROGRAM,
        CRAFTING_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        starbasePlayerPubkey,
        starbaseAccount.key,
        GAME_ID,
        GAME.data.gameState as PublicKey,
        craftingFacilityAccount.key,
        recipe.key,
        craftingFacilityAccount.data.domain as PublicKey,
        {
            keyIndex: 0,
            craftingId: craftingID,
            recipeCategoryIndex: recipeCategoryIdx,
            quantity: new BN(quantity),
            numCrew: new BN(crew),
        }
    ));
    const executed = await executeInstructions(instructions, "createCraftingProcess", "create");
    let craftingProcessKey: PublicKey;
    if(executed){
        craftingProcessKey= CraftingProcess.findAddress(
            CRAFTING_PROGRAM,
            starbaseAccount.data.craftingFacility as PublicKey,
            recipe.key,
            craftingID)[0];
    }
    return craftingProcessKey;
}

const starbaseCache ={};
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

export const cancelCraftingProcess = async (starbaseName:string, recipe: Recipe) => {
    const starbaseKey = await getStarbaseAddress(starbaseName);
    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const starbasePlayer = await getStarbasePlayerAddress(starbaseName);
    const starbaseCargoPod = await getCargoPodByAuthority(starbasePlayer);
    const starbasePlayerAccount = await getStarbasePlayerAccount(starbasePlayer);
    const craftingProcessList = await getCraftingProcessesForRecipe(starbaseName, recipe);
    const craftingProcess = craftingProcessList.find(process => process.data.status === 1) as CraftingProcess;
    const craftingFacilityAccount: CraftingFacility = await getCraftingFacilityAccount(starbaseName);
    const craftingInstances = await getCraftingInstances(starbaseName);
    const craftingInstance =
        craftingInstances.find(instance =>
            (instance.data.craftingProcess as PublicKey).toBase58() === craftingProcess.key.toBase58()) as CraftingInstance;
    const cargoStatsDefinition = await getCargoStatsDefinition();

    const instructions: InstructionReturn[] = [];
    for (let resIdx = 0; resIdx < recipe.data.consumablesCount; resIdx++) {
        const podTokenAcc = await getOrCreateAssociatedTokenAccount(
            getConnection(),
            recipe.ingredientInputsOutputs[resIdx].mint,
            starbaseCargoPod.key,
            true,
        );
        if (podTokenAcc.instructions != null) {
            instructions.push(podTokenAcc.instructions);
        }
        const ata = await getOrCreateAssociatedTokenAccount(
            getConnection(),
            recipe.ingredientInputsOutputs[resIdx].mint,
            craftingProcess.key,
            true);
        let someResourceAmount;
        if (ata.instructions != null) {
            instructions.push(ata.instructions);
        } else {
            someResourceAmount = Number((await getAccount(
                getConnection(),
                ata.address,
                'confirmed',
            )).delegatedAmount);
        }
        if (Number(someResourceAmount) > 0) {
            instructions.push(CraftingInstance.withdrawCraftingIngredient(
                SAGE_PROGRAM,
                CARGO_PROGRAM,
                CRAFTING_PROGRAM,
                signer,
                PLAYER_PROFILE_KEY,
                PROFILE_FACTION_KEY,
                starbasePlayerAccount.key,
                starbaseKey,
                craftingInstance.key,
                craftingProcess.key,
                starbaseAccount.data.craftingFacility as PublicKey,
                recipe.key,
                starbaseCargoPod.key,
                CargoType.findAddress(
                    CARGO_PROGRAM,
                    cargoStatsDefinition.key,
                    recipe.ingredientInputsOutputs[resIdx].mint,
                    cargoStatsDefinition.data.seqId as number,
                )[0],
                cargoStatsDefinition.key,
                ata.address,
                podTokenAcc.address,
                recipe.ingredientInputsOutputs[resIdx].mint,
                GAME_ID,
                GAME.data.gameState as PublicKey,
                {
                    amount: new BN(someResourceAmount),
                    keyIndex: 0,
                    ingredientIndex: resIdx
                }
            ));
        }
    }

    for (let ncIdx = recipe.data.consumablesCount; ncIdx < recipe.data.consumablesCount + recipe.data.nonConsumablesCount; ncIdx++) {
        const podTokenAcc = await getOrCreateAssociatedTokenAccount(
            getConnection(),
            recipe.ingredientInputsOutputs[ncIdx].mint,
            starbaseCargoPod.key,
            true,
        );
        if (podTokenAcc.instructions != null) {
            instructions.push(podTokenAcc.instructions);
        }
        const ata = await getOrCreateAssociatedTokenAccount(
            getConnection(),
            recipe.ingredientInputsOutputs[ncIdx].mint,
            craftingProcess.key,
            true,
        );

        instructions.push(CraftingInstance.claimCraftingNonConsumables(
            SAGE_PROGRAM,
            CARGO_PROGRAM,
            CRAFTING_PROGRAM,
            starbasePlayer,
            starbaseKey,
            craftingInstance.key,
            craftingProcess.key,
            recipe.key,
            starbaseCargoPod.key,
            CargoType.findAddress(
                this.sageGameHandler.cargoProgram,
                cargoStatsDefinition.key,
                recipe.ingredientInputsOutputs[ncIdx].mint,
                cargoStatsDefinition.data.seqId as number,
            )[0],
            cargoStatsDefinition.key,
            ata.address,
            podTokenAcc.address,
            recipe.ingredientInputsOutputs[ncIdx].mint,
            {ingredientIndex: ncIdx},
        ));
    }
    instructions.push(CraftingInstance.cancelCraftingProcess(
        SAGE_PROGRAM,
        CRAFTING_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        'funder',
        starbasePlayer,
        starbaseKey,
        craftingInstance.key,
        craftingProcess.key,
        starbaseAccount.data.craftingFacility as PublicKey,
        GAME_ID,
        GAME.data.gameState as PublicKey,
        {
            keyIndex: 0,
        },
    ));
    await executeInstructions(instructions, "Crafter", "cancelCraftingProcess");

}

export const depositIngredient = async (starbaseName: string,
                                        recipeName: string,
                                        ingredientMint:PublicKey,
                                        ingredientIndex: number,
                                        quantity: number,
                                        craftingInstanceAddress?:PublicKey)=>{
    const recipe = RECIPES.find(r=>byteArrayToString(r.data.namespace)===recipeName) as Recipe;
    const starbaseKey = await getStarbaseAddress(starbaseName);
    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const starbasePlayer = await getStarbasePlayerAddress(starbaseName);
    const starbaseCargoPod = await getCargoPodByAuthority(starbasePlayer);
    const starbasePlayerAccount = await getStarbasePlayerAccount(starbasePlayer);
    const craftingProcessList = await getCraftingProcessesForRecipe(starbaseName, recipe);
    //crafting process status == 1
    let craftingProcess;
    if(craftingInstanceAddress){
        craftingProcess = craftingProcessList.find(p=> p.key.toString()===craftingInstanceAddress.toString());
    }else{
        craftingProcess = craftingProcessList.find(process => process.data.status === 1) as CraftingProcess;
    }
    const craftingFacilityAccount: CraftingFacility = await getCraftingFacilityAccount(starbaseName);
    const craftingInstances = await getCraftingInstances(starbaseName);
    const craftingInstance =
        craftingInstances.find(instance =>
            (instance.data.craftingProcess as PublicKey).toBase58() === craftingProcess.key.toBase58()) as CraftingInstance;
    const cargoStatsDefinition = await getCargoStatsDefinition();
    const cargoTypeKey = CargoType.findAddress(
        CARGO_PROGRAM,
        cargoStatsDefinition.key,
        ingredientMint,
        cargoStatsDefinition.data.seqId as number)[0];

    const podTokenAccounts =
        await getParsedTokenAccountsByOwner(getConnection(), starbaseCargoPod.key);
    let podToken =
        podTokenAccounts.find((tokenAcc) => tokenAcc.mint.toBase58() === ingredientMint.toBase58()) as Account;
    const ata =
        createAssociatedTokenAccount(ingredientMint, craftingProcess.key);

    const instructions:InstructionReturn[] =[];
    instructions.push(ata.instructions);
    instructions.push(CraftingInstance.depositCraftingIngredient(
        SAGE_PROGRAM,
        CARGO_PROGRAM,
        CRAFTING_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        starbasePlayer,
        starbaseKey,
        craftingInstance.key,
        craftingProcess.key,
        starbaseAccount.data.craftingFacility as PublicKey,
        recipe.key,
        starbaseCargoPod.key,
        cargoTypeKey,
        cargoStatsDefinition.key,
        podToken.address,
        ata.address,
        GAME_ID,
        GAME.data.gameState,
        {
            amount: new BN(quantity),
            keyIndex: 0,
            ingredientIndex: ingredientIndex,
        },
    ));
    return await executeInstructions(instructions, "Crafter", "depositInfgedient");
}

export const startCraftingProcess = async (starbaseName: string, recipe: Recipe, quantity: number, craftingInstanceAddress?:PublicKey)=>{
    const atlasTokenFrom =  await getOrCreateAssociatedTokenAccount(
        getConnection(),
        ATLAS,
        wallet.publicKey,
        true);
    const atlas = await getAccount(getConnection(),atlasTokenFrom.address,'processed');
    if (Number(atlas.amount) / DECIMALS_atlas < Number(recipe.data.feeAmount) / Math.pow(10, 8) * quantity) {
        throw Error("Not enough monet to pay fees")
    }
    const atlasTokenTo =
        recipe.data.feeRecipient != null ? recipe.data.feeRecipient.key
            : GAME.data.vaults.atlas;


    const starbaseKey = await getStarbaseAddress(starbaseName);
    const starbaseAccount = await getStarbaseAccount(starbaseName);
    const starbasePlayer = await getStarbasePlayerAddress(starbaseName);
    const starbaseCargoPod = await getCargoPodByAuthority(starbasePlayer);
    const starbasePlayerAccount = await getStarbasePlayerAccount(starbasePlayer);
    const craftingProcessList = await getCraftingProcessesForRecipe(starbaseName, recipe);
    //crafting process status == 1
    let craftingProcess;
    if(craftingInstanceAddress){
        craftingProcess = craftingProcessList.find(p=> p.key.toString()===craftingInstanceAddress.toString());
    }else{
        craftingProcess = craftingProcessList.find(process => process.data.status === 1) as CraftingProcess;
    }
    const craftingFacilityAccount: CraftingFacility = await getCraftingFacilityAccount(starbaseName);
    const craftingInstances = await getCraftingInstances(starbaseName);
    const craftingInstance =
        craftingInstances.find(instance =>
            (instance.data.craftingProcess as PublicKey).toBase58() === craftingProcess.key.toBase58()) as CraftingInstance;
    const cargoStatsDefinition = await getCargoStatsDefinition();
    const instructions: InstructionReturn[] =[];
    instructions.push(CraftingInstance.startCraftingProcess(
        SAGE_PROGRAM,
        CRAFTING_PROGRAM,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        starbasePlayer,
        starbaseAccount.key,
        craftingInstance.key,
        craftingProcess.key,
        starbaseAccount.data.craftingFacility,
        recipe.key,
        GAME_ID,
        GAME.data.gameState,
        {
            keyIndex: 0,
        },
        signer,
        atlasTokenFrom.address,
        atlasTokenTo));
    return await executeInstructions(instructions, "Crafter", "startCraftingProcess");
}