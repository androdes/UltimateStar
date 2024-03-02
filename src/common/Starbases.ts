import {BN} from "@project-serum/anchor";
import {PublicKey} from "@solana/web3.js";

export const StarbaseCoordinates: { [key: string]: [BN, BN] } = {
    "UST-CSS":[new BN(40), new BN(30)],
    "UST-2":[new BN(42), new BN(35)],
    "UST-3":[new BN(48), new BN(32)],
    "UST-4":[new BN(38), new BN(25)],
    "UST-5":[new BN(30), new BN(28)],
    "MRZ-15": [new BN(22), new BN(5)],
    "MRZ-23": [new BN(44), new BN(10)],
    "MRZ-28": [new BN(17), new BN(21)],
    "MRZ-17": [new BN(16), new BN(-5)],
    "MRZ-22": [new BN(35), new BN(16)],
    "MRZ-21": [new BN(25), new BN(14)],
};

export const STARBASES: { [key: string]: PublicKey} ={
    "UST-CSS": new PublicKey("J8aYFqhRnMmT5MUJg6JhBFUWJMty7VRTMZMpsJA56ttG"),
}
export const STARBASE_PLAYERS: { [key: string]: PublicKey} ={
    "UST-CSS": new PublicKey("FSkrQMdPu3v3vsuh9C2hitbFho65j4XqSeiD269No6pK"),
}