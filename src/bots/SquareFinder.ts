import {SurveyDataUnitTracker} from "@staratlas/sage";
import {BN} from "@project-serum/anchor";
import {getSDUTracker} from "../core/SDUTracker.ts";
import {getConnection} from "../core/Globals.ts";
import {Connection, PublicKey} from "@solana/web3.js";

interface Point {
    x: number;
    y: number;
}

function findAccessibleSquares(currentPosition: Point, speedPerSecond: number): Point[] {
    const speedPerHour = speedPerSecond * 3600; // Convert speed to units per hour
    const maxDistance = Math.floor(speedPerHour); // Maximum number of cases that can be reached in an hour, rounded down to the nearest whole number
    const accessibleSquares: Point[] = [];
    const center: Point = { x: 0, y: 0 };
    const angleToCenterRadians = Math.atan2(center.y - currentPosition.y, center.x - currentPosition.x);

    for (let x = currentPosition.x - maxDistance; x <= currentPosition.x + maxDistance; x++) {
        for (let y = currentPosition.y - maxDistance; y <= currentPosition.y + maxDistance; y++) {
            if (x === currentPosition.x && y === currentPosition.y) continue; // Skip the current position itself
            const distance = Math.sqrt((x - currentPosition.x) ** 2 + (y - currentPosition.y) ** 2);
            if (distance <= maxDistance) {
                const angleToPointRadians = Math.atan2(y - currentPosition.y, x - currentPosition.x);
                let angleDifference = angleToPointRadians - angleToCenterRadians;
                angleDifference = (angleDifference + Math.PI * 2) % (Math.PI * 2); // Normalize angle to be within 0-2π radians
                if (angleDifference > Math.PI) angleDifference = Math.PI * 2 - angleDifference; // Adjust angle difference to be within π radians

                // Convert angle difference to degrees and check if within 15 degrees on either side of the direction to center
                if (Math.abs(angleDifference * (180 / Math.PI)) <= 15) {
                    accessibleSquares.push({x, y});
                }
            }
        }
    }

    return accessibleSquares.filter(square => Number.isInteger(square.x) && Number.isInteger(square.y));
}

// Exemple d'utilisation
const currentPosition = { x: 40, y: 30 };
const speedPerSecond = 0.0084; // Vitesse de déplacement en unités par seconde
const accessibleSquares = findAccessibleSquares(currentPosition, speedPerSecond);
//console.log(accessibleSquares);

const index = SurveyDataUnitTracker.findSectorIndex([new BN(accessibleSquares[0].x), new BN(accessibleSquares[0].y)]);
console.log(`Sector index [${accessibleSquares[0].x}, ${accessibleSquares[0].y}]= ${index}`);
const sduTracker = await getSDUTracker();
console.log((`Timestamp : ${sduTracker.sectors[index] as number}`));
const connection: Connection = getConnection();
const blockTime = sduTracker.sectors[index] as number;


async function fetchTransactionByBlockTime(connection, blockTime: number) {
    // Créer une connexion au réseau Solana


    try {
        // Obtenir le numéro de bloc correspondant à l'heure donnée
        const slot = await connection.getSlot(blockTime);
        console.log(`Slot ${slot}`);
        // Récupérer le bloc correspondant au numéro de bloc
        const blocks = (await connection.getBlockSignatures(slot-100, slot));
        for(const block of blocks){
            for (const tx of block.transactions) {
                // Vérifier si l'horodatage de la transaction correspond à celui recherché
                if (tx.meta?.blockTime === blockTime) {
                    // Récupérer les détails de la transaction à l'aide de son identifiant
                    const transaction = await connection.getTransaction(tx.transaction, {
                        maxSupportedTransactionVersion: 0 // Spécifier la version de transaction prise en charge
                    });
                    return transaction;
                }
            }
        }
        // Parcourir toutes les transactions du bloc


        // Si aucune transaction correspondante n'est trouvée
        return null;
    } catch (error) {
        console.error('Erreur lors de la récupération de la transaction : ', error);
        throw error;
    }
}

const transaction = await fetchTransactionByBlockTime(connection, blockTime);
console.log(`${transaction?.meta?.logMessages}`);