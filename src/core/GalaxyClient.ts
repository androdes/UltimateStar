import {PublicKey, Transaction} from "@solana/web3.js";
import {ATLAS, DECIMALS_atlas, GAME_ID, SAGE_RESOURCES_MINTS, TRADER_PROGRAM_ID} from "../common/Constants.ts";
import {GmClientService, Order, OrderSide} from "@staratlas/factory";
import {BN} from "@project-serum/anchor";
import {
    CARGO_PROGRAM, executeTransaction,
    GAME,
    getConnection,
    PLAYER_PROFILE_KEY, prepareTransaction,
    PROFILE_FACTION_KEY,
    SAGE_PROGRAM,
    verifyTransaction
} from "./Globals.ts";
import {signer} from "./Wallet.ts";
import {
    getStarbaseAddress,
    getStarbaseAmountByMint,
    getStarbasePlayerAddress,
    getStarbaseResourceAmount
} from "./StarbaseManager.ts";
import {getParsedTokenAccountsByOwner} from "@staratlas/data-source";
import {getCargoPodByAuthority, getCargoStatsDefinition, getCargoTypeAddress} from "./CargoManager.ts";
import {getAssociatedTokenAddressSync} from "@solana/spl-token";
import {getOrCreateAssociatedTokenAccount, StarbasePlayer} from "@staratlas/sage";


const gmClientService = new GmClientService();
let ordersSnapshot = undefined;
let lastUpdateTime = 0; // Stocke le temps du dernier update
export const getAllOrders = async(update: boolean) => {
     // Suppose que cette fonction gère la limitation des appels

    const currentTime = Date.now();
    const oneMinute = 15 * 1000; // 60 secondes * 1000 millisecondes
    const timeElapsed = currentTime - lastUpdateTime;

    // Effectuer l'update uniquement si `update` est vrai ET plus d'une minute s'est écoulée
    // OU si `ordersSnapshot` est undefined (premier appel ou aucun cache disponible)
    if ((update && timeElapsed >= oneMinute) || !ordersSnapshot) {
        ordersSnapshot = await gmClientService.getAllOpenOrders(
            getConnection(),
            new PublicKey(TRADER_PROGRAM_ID),
        );
        lastUpdateTime = Date.now(); // Met à jour le temps du dernier update
    }

    // Si `update` est faux, cette condition est ignorée et la fonction retournera
    // toujours `ordersSnapshot`, respectant ainsi la demande de toujours retourner le cache
    // si `update` est à false, indépendamment du temps écoulé depuis le dernier update.

    return ordersSnapshot;
};

export const getHighestBuyOrder = async (resource: PublicKey, update=false)=>{
    const [buyOrder] = (await getAllResourceBuyOrders(resource, update))

        .sort((a, b) => (a.price.toNumber() / DECIMALS_atlas > b.price.toNumber() / DECIMALS_atlas ? -1 : 1));
    if(buyOrder.length>0){
        return buyOrder.splice(0, 1);
    }
    return buyOrder;
}

export const cancelOrder = async (order: Order)=>{
    const tx = await gmClientService.getCancelOrderTransaction(
        getConnection(),
        new PublicKey(order.id),
        new PublicKey(order.owner),
        new PublicKey("traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg"));
    const transaction = new Transaction()
        .add(tx.transaction);
    console.log(`Sending cancel order`);
    try {
        const sig = await getConnection().sendTransaction(transaction, [signer, ...tx.signers]);
        const result = await getConnection().confirmTransaction(sig, 'confirmed');
        if (result.value.err) {
            console.log("Failed to order");
        }
    } catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
        }
    }
}

export const getLowestSellOrder = async (resource: PublicKey, update=false) => {
    const [sellOrder] = ((await getAllResourceSellOrders(resource, update))
        .sort((a, b) => (a.price.toNumber() / DECIMALS_atlas < b.price.toNumber() / DECIMALS_atlas ? -1 : 1)));
    if(sellOrder && sellOrder.length>0){
        return sellOrder.splice(0, 1);
    }
    return sellOrder;
}

export const getResourceOrders = async (resource: string, update=false)=>{
    return (await getAllOrders(update)).filter((order)=> order.orderMint === SAGE_RESOURCES_MINTS[resource].toString());
}

export const getAllResourceSellOrders = async (resource: PublicKey, update=false)=>{
    return (await getAllOrders(update)).filter((order) => order && order.orderMint === resource.toString()
        && order.orderType==="sell"
        && order.currencyMint === ATLAS.toString());
}

export const getResourceSellOrders = async (resource: PublicKey, update=false)=>{
    const allOrders = await getAllOrders(update);
    const filteredOrders = allOrders.filter((order) =>
        order &&
        order.orderMint === resource.toString() &&
        order.orderType==="sell" &&
        order.currencyMint === ATLAS.toString()
    );
    // Trier par order.price en ordre ascendant
    const sortedOrders = filteredOrders.sort((a, b) => a.price - b.price);

    return sortedOrders;
}

export const getResourceBuyOrders = async (resource: PublicKey, update=false) => {
    const allOrders = await getAllOrders(update);
    const filteredOrders = allOrders.filter((order) =>
        order &&
        order.orderMint === resource.toString() &&
        order.orderType === "buy" &&
        order.currencyMint === ATLAS.toString()
    );

    // Trier par order.price en ordre descendant
    const sortedOrders = filteredOrders.sort((a, b) => b.price - a.price);

    return sortedOrders;
}

// Fonction pour calculer le coût total pour acheter une quantité donnée
export const calculateTotalBuyCost = async (resource: PublicKey, desiredQuantity: number, update=false) => {
    const allBuyOrders = await getResourceSellOrders(resource, update);//<==========
    //console.log(`BuyAt: ${resource.toString()} : ${allBuyOrders[0].price/DECIMALS_atlas}`);
    let quantityToBuy = desiredQuantity;
    let totalCost = 0;

    for (const order of allBuyOrders) {
        if (quantityToBuy <= 0) break; // Sortie anticipée si la quantité souhaitée est déjà atteinte

        const availableQuantity = order.orderQtyRemaining;
        const quantityForThisOrder = Math.min(quantityToBuy, availableQuantity);

        // Calcul du coût pour la quantité désirée ou la quantité restante disponible dans l'ordre
        const costForThisOrder = order.priceForQuantity(quantityForThisOrder);
        totalCost += costForThisOrder;

        quantityToBuy -= quantityForThisOrder; // Diminution de la quantité restante à acheter

    }

    if (quantityToBuy > 0) {
        console.warn("La quantité désirée dépasse la quantité disponible dans les ordres d'achat.");
        // Vous pourriez traiter ce cas selon vos besoins (par exemple, retourner le coût total jusqu'à présent)
    }

    return totalCost;
}

// Fonction pour calculer le revenu total pour vendre une quantité donnée
export const calculateTotalSellRevenue = async (resource: PublicKey, desiredQuantity: number, update=false) => {
    const allSellOrders = await getAllResourceBuyOrders(resource, update);
    //console.log(`SELL At: ${resource.toString()} : ${allSellOrders[0].price/DECIMALS_atlas}`);
    let quantityToSell = desiredQuantity;
    let totalRevenue = 0;

    for (const order of allSellOrders) {
        if (quantityToSell <= 0) break; // Sortie anticipée si la quantité souhaitée est déjà atteinte

        const availableQuantity = order.orderQtyRemaining;
        const quantityForThisOrder = Math.min(quantityToSell, availableQuantity);

        // Calcul du revenu pour la quantité désirée ou la quantité restante disponible dans l'ordre
        const revenueForThisOrder = order.priceForQuantity(quantityForThisOrder);
        totalRevenue += revenueForThisOrder;

        quantityToSell -= quantityForThisOrder; // Diminution de la quantité restante à vendre
    }

    if (quantityToSell > 0) {
        console.warn("La quantité désirée dépasse la quantité disponible dans les ordres de vente.");
        // Vous pourriez traiter ce cas selon vos besoins (par exemple, retourner le revenu total jusqu'à présent)
    }

    return totalRevenue;
}





export const getAllResourceBuyOrders = async (resource: PublicKey, update=false)=>{

    return (await getAllOrders(update)).filter((order) => {

        return order && order.orderMint === resource.toString()
            && order.orderType==="buy"
            && order.currencyMint === ATLAS.toString()
    });
}

export const getOwnerBuyOrderForResource = async(owner: PublicKey, resource: PublicKey)=>{
    const buyOrders: Order[] =(await getAllResourceBuyOrders(resource, true));
    if(buyOrders){
        return buyOrders.filter(order=>order.owner===owner.toString());
    }
    return [];
}

export const resourceAmountInWallet = async (resource: PublicKey)=>{
    const tokenAccount = (
        await getParsedTokenAccountsByOwner(
            getConnection(),
            signer.publicKey()
        )
    ).find(
        (tokenAccount) => tokenAccount.mint.toBase58() === resource.toBase58()
    );
    return Number(tokenAccount?.amount);
}

export const depositIntoGame = async (resource: PublicKey, amount: number)=>{
    if(isNaN(amount)){
        console.log("amount is NaN");
        return 0;
    }
    console.log(`Amount ${amount} ${BigInt(amount)}`);
    const starbase = await getStarbaseAddress("UST-CSS");
    const starbasePlayer = await getStarbasePlayerAddress("UST-CSS");
    const cargoTypes = getCargoTypeAddress(resource);
    const [cargoType] = cargoTypes;
    const cargoPods = await getCargoPodByAuthority(starbasePlayer);
    const from = await getAssociatedTokenAddressSync(resource, signer.publicKey())
        , to = await getOrCreateAssociatedTokenAccount(getConnection(), resource, cargoPods.key, true);
    const cargoStatsDefinition =await getCargoStatsDefinition();
    const ix = [];
    if(to.instructions){
        ix.push(to.instructions);
    }
    const movingAmount = new BN(amount);
    const gameState =GAME.data.gameState as PublicKey;
    const input ={
        amount: await new BN(amount),
        keyIndex: 0
    }
    ix.push(await StarbasePlayer.depositCargoToGame(
        SAGE_PROGRAM,
        CARGO_PROGRAM,
        starbasePlayer,
        signer,
        PLAYER_PROFILE_KEY,
        PROFILE_FACTION_KEY,
        starbase,
        new PublicKey("YLDNhVCX64CmSTrc5SQsKVhR8nBvW5AM3p69B928Ygq"),
        cargoType,
        cargoStatsDefinition.key,
        from,
        to.address,
        GAME_ID,
        gameState,
        input));
    try {
        let tx = await prepareTransaction(ix);
        let rx = await executeTransaction(tx);
        if (rx.value.isOk()) {
            console.log(`Deposit into starbase ok`);
            return amount;
        }else{
            console.log(``, rx.value);
        }
    } catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            if(await verifyTransaction(e.signature)){
                console.log(`Deposit into starbase ok`);
                return amount;
            }
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
        }
    }

}

export async function maintainTopBuyOrders(materials, minQuantity, updateInterval) {
    function shouldUpdateMyOrder(buyOrder: Order, sellOrder, starbaseAmount, minAmount, publicKey: PublicKey) {
        console.log(`buyOrder.owner !=publicKey.toString() ${buyOrder.owner !=publicKey.toString()}`);
        console.log(`buyOrder.price<sellOrder.price ${buyOrder.price<sellOrder.price}`);
        console.log(`minAmount/2>starbaseAmount ${minAmount/2>starbaseAmount}`);
        if(buyOrder &&
            buyOrder.owner !=publicKey.toString()
            && buyOrder.price<sellOrder.price
            && minAmount/2>starbaseAmount){
            return true;
        }
        return false;
    }

    while (true) {
        for (const material of materials) {
            try {
                const resourceInWallet = await resourceAmountInWallet(SAGE_RESOURCES_MINTS[material]);
                const resourceAmountInStarbase = await getStarbaseResourceAmount("UST-CSS",material);
                console.log(`${material} ${resourceAmountInStarbase}`)
                if(resourceInWallet>0){
                    console.log(`Found ${resourceInWallet} ${material} ==> moving to game`);
                    await depositIntoGame(SAGE_RESOURCES_MINTS[material], resourceInWallet);
                }
                const lowestSellOrder: Order = await getLowestSellOrder(SAGE_RESOURCES_MINTS[material], true);
                const highestBuyOrder = await getHighestBuyOrder(SAGE_RESOURCES_MINTS[material], true);
                if (highestBuyOrder
                    && lowestSellOrder
                    && shouldUpdateMyOrder(
                        highestBuyOrder,
                        lowestSellOrder,
                        resourceAmountInStarbase,
                        minQuantity,
                        signer.publicKey())) {
                    console.log(`Cancel and topup ${material}`);
                    const [orderToCancel] = await getOwnerBuyOrderForResource(signer.publicKey(), SAGE_RESOURCES_MINTS[material]);
                    if(orderToCancel){
                        console.log(`Canceling order for ${material} ${orderToCancel.id}`)
                        await cancelOrder(orderToCancel);
                    }
                    console.log(`Top up ${material}`)
                    await topupResource(
                        "UST-CSS",
                        SAGE_RESOURCES_MINTS[material].toString(),
                        minQuantity);
                }

            } catch (error) {
                console.error(`Error managing buy order for ${material}:`, error);
            }

        }

        // Wait for the specified interval before the next update
        await new Promise(resolve => setTimeout(resolve, updateInterval));
    }
}

export const topupResource = async(starbase: string, mint: string, topQuantity: number, immediate = false)=>{
    const starbaseAmount = await getStarbaseAmountByMint(starbase, mint);
    let orderedAmount = topQuantity - starbaseAmount;
    if(orderedAmount>0){
        const mintKey = new PublicKey(mint);
        const highestOrder = await getHighestBuyOrder(mintKey, true);
        let price = highestOrder.price.toNumber();
        console.log("HighestOrder", price/DECIMALS_atlas);
        price+=2;
        console.log("Order price ", price/DECIMALS_atlas);
        const ixs = [];
        const tx = await gmClientService.getInitializeOrderTransaction(
            getConnection(),
            signer.publicKey(), // orderCreator
            mintKey, // itemMint
            ATLAS, // quiteMint
            orderedAmount, // quantity
            new BN(price), // price
            new PublicKey("traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg"), // programId traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg
            OrderSide.Buy // orderSide
        );
        const transaction = new Transaction()
            .add(tx.transaction);
        console.log(`Sending buy order`);
        try {
            const sig = await getConnection().sendTransaction(transaction, [signer, ...tx.signers]);
            const result = await getConnection().confirmTransaction(sig, 'confirmed');
            if(result.value.err){
                console.log("Failed to order");
            }
        }catch (e) {

            if (e && e.signature) {
                console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
                await verifyTransaction(e.signature);
            } else {
                console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
            }
        }

    }
}

export const exchangeOrderSell = async (resourceMint: PublicKey, quantity: number)=>{
    const highestBuyOrder = await getHighestBuyOrder(resourceMint);
    const exchangeQT = Math.min(highestBuyOrder.orderQtyRemaining, quantity);
    console.log(`Highest buy order : ${highestBuyOrder.price/DECIMALS_atlas} qt sold:${exchangeQT}`);
    const {transaction, signers } = await gmClientService.getCreateExchangeTransaction(
        getConnection(),
        highestBuyOrder,
        signer.publicKey(),
        exchangeQT,
        new PublicKey("traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg"));

    console.log(`Sending exchange(sell) order`);
    try {
        const sig = await getConnection().sendTransaction(transaction, [signer, ...signers]);
        const result = await getConnection().confirmTransaction(sig, 'confirmed');
        if(result.value.err){
            console.log("Exchange(sell) failed ");

        }else{
            console.log(`Sold ${resourceMint.toString()} for ${exchangeQT*highestBuyOrder.price/DECIMALS_atlas}`)
            if(exchangeQT<quantity){
                await exchangeOrderSell(resourceMint, quantity-exchangeQT);
            }
        }
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
        }
    }
}

export const exchangeOrderBuy = async (resourceMint: PublicKey, quantity: number)=>{
    const lowestSellOrder = await getLowestSellOrder(resourceMint);
    const exchangeQT = Math.min(lowestSellOrder.orderQtyRemaining, quantity);
    console.log(`Lowest sell order : ${lowestSellOrder.price/DECIMALS_atlas} qt bought:${exchangeQT}`);
    const {transaction, signers } = await gmClientService.getCreateExchangeTransaction(
        getConnection(),
        lowestSellOrder,
        signer.publicKey(),
        exchangeQT,
        new PublicKey("traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg"));

    console.log(`Sending exchange(buy) order`);
    try {
        const sig = await getConnection().sendTransaction(transaction, [signer, ...signers]);
        const result = await getConnection().confirmTransaction(sig, 'confirmed');
        if(result.value.err){
            console.log("Exchange(buy) failed ");
        }else{
            if(exchangeQT<quantity){
                await exchangeOrderBuy(resourceMint, quantity-exchangeQT);
            }
        }
    }catch (e) {

        if (e && e.signature) {
            console.log(`Erreur lors de la transaction, vérification de la signature : ${e.signature}`);
            await verifyTransaction(e.signature);
        } else {
            console.error(`Erreur sans signature de transaction : ${e} ${JSON.stringify(e)}`);
        }
    }
}

