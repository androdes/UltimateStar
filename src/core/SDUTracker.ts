import {readFromRPCOrError} from "@staratlas/data-source";
import {SurveyDataUnitTracker} from "@staratlas/sage/src";
import {getConnection, SAGE_PROGRAM} from "./Globals.ts";
import {signer} from "./Wallet.ts";
import {PublicKey} from "@solana/web3.js";

export const getSDUTracker = async ()=>{
    return await readFromRPCOrError(
        getConnection(),
        SAGE_PROGRAM,
        new PublicKey("EJ74A2vb3HFhaEh4HqdejPpQoBjnyEctotcx1WudChwj"),
        SurveyDataUnitTracker,
        'confirmed',
    );
}

export const getNbSDULastMinute = async ()=>{
    return (await getSDUTracker()).data.surveyDataUnitBySecond.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
}

export const getNbSDULastSeconds = async (seconds: number)=>{
    return (await getSDUTracker()).data.surveyDataUnitBySecond.slice(-seconds).reduce((accumulator, currentValue) => accumulator + currentValue, 0);
}