import {PublicKey} from "@solana/web3.js";
import {PlanetType} from "@staratlas/sage";
import {SAGE_PROGRAM} from "./Globals.ts";

interface SagePlanetAddresses {
    [key: string]: PublicKey;
}
export const PLANETS = await SAGE_PROGRAM.account.planet.all();
export const PLANET_LOOKUP = PLANETS.reduce((lookup, planetAccount) => {
    const pubkey = planetAccount.publicKey;
    const planet = planetAccount.account;

    if (planet.planetType === PlanetType.AsteroidBelt) {
        const sector = planet.sector.toString();
        lookup[sector] = pubkey;
    }
    return lookup;
}, {} as SagePlanetAddresses);