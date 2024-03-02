import {Keypair, PublicKey} from "@solana/web3.js";
import bs58 from "bs58";
import NodeWallet from "@project-serum/anchor/dist/esm/nodewallet";
import {keypairToAsyncSigner} from "@staratlas/data-source";

const secretKey = Bun.env.SOLANA_WALLET_SECRET_KEY;
if (!secretKey) {
    throw new Error("SOLANA_WALLET_SECRET_KEY environment variable is not set");
}
const funder: Keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
export const signer = keypairToAsyncSigner(funder);
if (!PublicKey.isOnCurve(funder.publicKey.toBytes())) {
    throw Error("wallet keypair is not on curve");
}
export const wallet =new NodeWallet(funder);
