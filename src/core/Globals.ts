import {Game, SAGE_IDL, SagePlayerProfile} from "@staratlas/sage";
import {
    CARGO_PROGRAM_ID, CRAFTING_PROGRAM_ID,
    GAME_ID,
    PLAYER_PROFILE_PROGRAM_ID,
    PROFILE_FACTION_PROGRAM_ID,
    SAGE_PROGRAM_ID, TRADER_PROGRAM_ID
} from "../common/Constants.ts";

import {PROFILE_FACTION_IDL, ProfileFactionAccount} from "@staratlas/profile-faction";
import {Connection, PublicKey} from "@solana/web3.js";
import {signer, wallet} from "./Wallet.ts";
import {AnchorProvider, Program} from "@project-serum/anchor";
import {CARGO_IDL} from "@staratlas/cargo";
import {PLAYER_PROFILE_IDL} from "@staratlas/player-profile";
import {CRAFTING_IDL} from "@staratlas/crafting";
import {GALACTIC_MARKETPLACE_IDL} from "@staratlas/galactic-marketplace";
import {
    buildAndSignTransaction,
    InstructionReturn,
    readFromRPCOrError,
    sendTransaction,
    TransactionReturn
} from "@staratlas/data-source";





(function() {
    // Sauvegardez la référence à l'implémentation originale de console.log
    const originalConsoleLog = console.log;

    // Remplacez console.log par une fonction personnalisée
    console.log = function() {
        // Obtenez l'heure actuelle
        const now = new Date();
        // Formatez l'heure pour inclure seulement les heures, minutes et secondes
        const timestamp = now.toLocaleTimeString(); // cela donnera "HH:MM:SS" basé sur le fuseau horaire de l'utilisateur

        // Convertissez tous les arguments de log en un tableau
        const args = Array.from(arguments);

        // Ajoutez le timestamp suivi d'un espace au début des arguments
        args.unshift(timestamp + " "); // Ajoutez un espace directement après le timestamp

        // Appelez l'implémentation originale de console.log avec le nouveau préfixe et les autres arguments
        originalConsoleLog.apply(console, args);
    };
})();

console.log("LOADING Globals");
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


let lastTxSend=new Date().getTime();
let connection = undefined;
export async function rateLimit() {
    const baseDelay = 500; // Délai de base en millisecondes
    const additionalDelay = 0; // Délai supplémentaire pour réduire la fréquence
    while (new Date().getTime() - lastTxSend< baseDelay + additionalDelay){
        await sleep(baseDelay + additionalDelay);
    }
    lastTxSend = new Date().getTime();
}

export const randomUint8Arr = (): Uint8Array => {
    const byteArray = new Uint8Array(6);
    for (let c = 0; c < 6; c++) {
        byteArray[c] = (Math.random() * 256) & 0xff;
    }
    return byteArray;
};

await rateLimit();
const [accountInfo] = await getConnection().getProgramAccounts(
    new PublicKey(PLAYER_PROFILE_PROGRAM_ID),
    {
        filters: [
            {
                memcmp: {
                    offset: 30,
                    bytes: wallet.publicKey.toBase58(),
                },
            },
        ],
    }
);
export const PLAYER_PROFILE_KEY = accountInfo.pubkey;
await rateLimit();
const provider = new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions()
);
await rateLimit();
export const SAGE_PROGRAM = new Program(
    SAGE_IDL,
    new PublicKey(SAGE_PROGRAM_ID),
    provider
);
await rateLimit();
export const CARGO_PROGRAM = new Program(
    CARGO_IDL,
    new PublicKey(CARGO_PROGRAM_ID),
    provider
);
await rateLimit();
export const PLAYER_PROFILE_PROGRAM = new Program(
    PLAYER_PROFILE_IDL,
    new PublicKey(PLAYER_PROFILE_PROGRAM_ID),
    provider
);
await rateLimit();
export const PROFILE_FACTION_PROGRAM = new Program(
    PROFILE_FACTION_IDL,
    new PublicKey(PROFILE_FACTION_PROGRAM_ID),
    provider
);
await rateLimit();
export const CRAFTING_PROGRAM = new Program(
    CRAFTING_IDL,
    new PublicKey(CRAFTING_PROGRAM_ID),
    provider
);
await rateLimit();
export const TARDER_PROGRAM = new Program(
    GALACTIC_MARKETPLACE_IDL,
    new PublicKey(TRADER_PROGRAM_ID),
    provider
);

await rateLimit();
export function getConnection() {
    if (!connection) {
        return connection = new Connection(Bun.env.SOLANA_RPC_URL || "", "confirmed");
    }
    return connection;
}
export const getTransactionDetails = async (transaction: string)=>{
    const con:Connection = getConnection();
    return await con.getParsedTransaction(transaction);
}
await rateLimit();
export const [SAGE_PLAYER_PROFILE] = SagePlayerProfile.findAddress(
    SAGE_PROGRAM,
    PLAYER_PROFILE_KEY,
    GAME_ID
);
await rateLimit();
export const [PROFILE_FACTION_KEY] = ProfileFactionAccount.findAddress(
    PROFILE_FACTION_PROGRAM,
    PLAYER_PROFILE_KEY
);

export const prepareTransaction = async (instructions: InstructionReturn | InstructionReturn[]) => {
    try{
        return await buildAndSignTransaction(instructions, signer, {connection: getConnection()});
    }catch (e) {
        console.log(e);
        await waitForState("SIGNATURE FAILED RETRYING IN 3 SECONDS", 3);
        return await buildAndSignTransaction(instructions, signer, {connection: getConnection(), commitment: "confirmed"});
    }

}


export const executeTransaction = async (tx: TransactionReturn) => {
    return await sendTransaction(tx, getConnection(), {sendOptions:{skipPreflight: true}, commitment: 'confirmed'});
}


// Fonction pour vérifier l'état d'une transaction
export const verifyTransaction = async (transactionSignature, withSignature=false): Promise<boolean | any> => {
    try {
        // Récupérer les détails de la transaction
        const transactionResponse = await getConnection().getTransaction(transactionSignature);

        if (transactionResponse) {
            // Vérifier si la transaction est confirmée
            if (transactionResponse.meta && transactionResponse.meta.err === null) {
                console.log("Transaction confirmée avec succès!");
                if(withSignature){
                    return transactionResponse;
                }
                return true;
            } else {
                console.log("Transaction échouée avec l'erreur: ", transactionResponse.meta.err);
                return false;
            }
        } else {
            console.log("Aucune information trouvée pour cette transaction. Elle a peut-être expiré.");
            return false;
        }
    } catch (error) {
        console.error("Erreur lors de la vérification de la transaction: ", error);
        return false;
    }
};
export const waitForState = async (fleetName: string, time: number) => {
    console.log(`${fleetName} Waiting for ${time}`);
    await new Promise((resolve) => setTimeout(resolve, time*1000));
}

export const GAME_KEY = new PublicKey(GAME_ID);
await rateLimit();
export const GAME: Game = await readFromRPCOrError(
    connection,
    SAGE_PROGRAM,
    GAME_KEY,
    Game,
    "confirmed"
);

export const executeInstructions = async (instructions: InstructionReturn[], submitter="Bot", intructionName="Instruction")=>{

    try {
        let tx = await prepareTransaction(instructions);
        console.log(`${submitter} tx prepared ${intructionName}`);
        let rx= await executeTransaction(tx);
        if (!rx.value.isOk()) {
            throw Error(`${submitter} can not ${intructionName} `);
            return false;
        }
        console.log(`${submitter} executed ${intructionName}!`);
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            return await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
            return false;
        }
    }
    return true;
}

export async function withTimeout(promiseFn: () => Promise<any>, seconds: number): Promise<any> {
    // Convertit les secondes en millisecondes pour setTimeout
    let timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Temps écoulé")), seconds * 1000));
    try {
        // Attend la première promesse résolue (soit la promiseFn, soit le timeout)
        return await Promise.race([promiseFn(), timeoutPromise]);
    } catch (error) {
        // Gère l'erreur (timeout ou erreur de promiseFn)
        throw error;
    }
}