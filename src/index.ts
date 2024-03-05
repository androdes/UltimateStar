import {getSDUTracker} from "./core/SDUTracker.ts";
import {BN} from "@project-serum/anchor";
import {SurveyDataUnitTracker} from "@staratlas/sage/src";

const sduTracker = await getSDUTracker();

console.log(`${JSON.stringify(new BN(sduTracker.sectors[0]).toString())}`);
const units = sduTracker.data.surveyDataUnitBySecond.slice(-1).reduce((acc, current) => acc + current, 0);
console.log(`HIT ${units}`);