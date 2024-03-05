import {exchangeOrderBuy, exchangeOrderSell} from "../core/GalaxyClient.ts";
import {SAGE_RESOURCES_MINTS} from "../common/Constants.ts";


await exchangeOrderBuy(SAGE_RESOURCES_MINTS["tool"], 5000);