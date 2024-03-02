import {PublicKey} from "@solana/web3.js";

export const GAME_ID = new PublicKey("GameYNgVLn9kd8BQcbHm8jNMqJHWhcZ1YTNy6Pn3FXo5");
export const SAGE_PROGRAM_ID =
    "SAGEqqFewepDHH6hMDcmWy7yjHPpyKLDnRXKb3Ki8e6";
export const CARGO_PROGRAM_ID =
    "Cargo8a1e6NkGyrjy4BQEW4ASGKs9KSyDyUrXMfpJoiH";
export const PLAYER_PROFILE_PROGRAM_ID =
    "pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9";
export const PROFILE_FACTION_PROGRAM_ID =
    "pFACSRuobDmvfMKq1bAzwj27t6d2GJhSCHb1VcfnRmq";
export const CRAFTING_PROGRAM_ID =
    "Craftf1EGzEoPFJ1rpaTSQG1F6hhRRBAf4gRo9hdSZjR";
export const TRADER_PROGRAM_ID = "traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg";
export const ATLAS = new PublicKey('ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx');
export const DECIMALS_atlas = 100000000;


export interface SageRecipes {
    [key: string]: string;
}

export interface SageResourcesMints {
    [key: string]: PublicKey;
}
export const SAGE_RESOURCES_MINTS: SageResourcesMints = {
    food: new PublicKey("foodQJAztMzX1DKpLaiounNe2BDMds5RNuPC6jsNrDG"),
    Food: new PublicKey("foodQJAztMzX1DKpLaiounNe2BDMds5RNuPC6jsNrDG"),
    ammo: new PublicKey("ammoK8AkX2wnebQb35cDAZtTkvsXQbi82cGeTnUvvfK"),
    Ammunition: new PublicKey("ammoK8AkX2wnebQb35cDAZtTkvsXQbi82cGeTnUvvfK"),
    fuel: new PublicKey("fueL3hBZjLLLJHiFH9cqZoozTG3XQZ53diwFPwbzNim"),
    Fuel: new PublicKey("fueL3hBZjLLLJHiFH9cqZoozTG3XQZ53diwFPwbzNim"),
    tool: new PublicKey("tooLsNYLiVqzg8o4m3L2Uetbn62mvMWRqkog6PQeYKL"),
    arco: new PublicKey("ARCoQ9dndpg6wE2rRexzfwgJR3NoWWhpcww3xQcQLukg"),
    biomass: new PublicKey("MASS9GqtJz6ABisAxcUn3FeR4phMqH1XfG6LPKJePog"),
    carbon: new PublicKey("CARBWKWvxEuMcq3MqCxYfi7UoFVpL9c4rsQS99tw6i4X"),
    diamond: new PublicKey("DMNDKqygEN3WXKVrAD4ofkYBc4CKNRhFUbXP4VK7a944"),
    hydrogen: new PublicKey("HYDR4EPHJcDPcaLYUcNCtrXUdt1PnaN4MvE655pevBYp"),
    iron_ore: new PublicKey("FeorejFjRRAfusN9Fg3WjEZ1dRCf74o6xwT5vDt3R34J"),
    copper_ore: new PublicKey("CUore1tNkiubxSwDEtLc3Ybs1xfWLs8uGjyydUYZ25xc"),
    lumanite: new PublicKey("LUMACqD5LaKjs1AeuJYToybasTXoYQ7YkxJEc4jowNj"),
    rochinol: new PublicKey("RCH1Zhg4zcSSQK8rw2s6rDMVsgBEWa4kiv1oLFndrN5"),
    sdu: new PublicKey("SDUsgfSZaDhhZ76U3ZgvtFiXsfnHbf2VrzYxjBZ5YbM"),
    goldenticket: new PublicKey("GLDTKDYdSkdCzSC6fqRWqHZ5fUQGsm1CM4nMZnsCZNcX"),
    energysubstrate: new PublicKey("SUBSVX9LYiPrzHeg2bZrqFSDSKkrQkiCesr6SjtdHaX"),
    electromagnet: new PublicKey("EMAGoQSP89CJV5focVjrpEuE4CeqJ4k1DouQW7gUu7yX"),
    framework: new PublicKey("FMWKb7YJA5upZHbu5FjVRRoxdDw2FYFAu284VqUGF9C2"),
    powersource: new PublicKey("PoWRYJnw3YDSyXgNtN3mQ3TKUMoUSsLAbvE8Ejade3u"),
    particleaccelerator: new PublicKey("PTCLSWbwZ3mqZqHAporphY2ofio8acsastaHfoP87Dc"),
    radiationabsorber: new PublicKey("RABSXX6RcqJ1L5qsGY64j91pmbQVbsYRQuw1mmxhxFe"),
    superconductor: new PublicKey("CoNDDRCNxXAMGscCdejioDzb6XKxSzonbWb36wzSgp5T"),
    strangeemitter: new PublicKey("EMiTWSLgjDVkBbLFaMcGU6QqFWzX9JX6kqs1UtUjsmJA"),
    crystallattice: new PublicKey("CRYSNnUd7cZvVfrEVtVNKmXiCPYdZ1S5pM5qG2FDVZHF"),
    crystallattice2: new PublicKey("CRYSNnUd7cZvVfrEVtVNKmXiCPYdZ1S5pM5qG2FDVZHF"),
    crystallattice3: new PublicKey("CRYSNnUd7cZvVfrEVtVNKmXiCPYdZ1S5pM5qG2FDVZHF"),
    copperwire: new PublicKey("cwirGHLB2heKjCeTy4Mbp4M443fU4V7vy2JouvYbZna"),
    copper: new PublicKey("CPPRam7wKuBkYzN5zCffgNU17RKaeMEns4ZD83BqBVNR"),
    electronics: new PublicKey("ELECrjC8m9GxCqcm4XCNpFvkS8fHStAvymS6MJbe3XLZ"),
    graphene: new PublicKey("GRAPHKGoKtXtdPBx17h6fWopdT5tLjfAP8cDJ1SvvDn4"),
    hydrocarbon: new PublicKey("HYCBuSWCJ5ZEyANexU94y1BaBPtAX2kzBgGD2vES2t6M"),
    iron: new PublicKey("ironxrUhTEaBiR9Pgp6hy4qWx6V2FirDoXhsFP25GFP"),
    magnet: new PublicKey("MAGNMDeDJLvGAnriBvzWruZHfXNwWHhxnoNF75AQYM5"),
    polymer: new PublicKey("PoLYs2hbRt5iDibrkPT9e6xWuhSS45yZji5ChgJBvcB"),
    steel: new PublicKey("STEELXLJ8nfJy3P4aNuGxyNRbWPohqHSwxY75NsJRGG"),
    councilrfr: new PublicKey("CRFRjhzDEhBSWGqpfdnqUHnbPLrimcuQ69kT9XE6tyRr"),
    calicomaxhog: new PublicKey("GxpbUDxYYvxiUejHcAMzeV2rzdHf6KZZvT86ACrpFgXa"),
    fimbulairbike: new PublicKey("Fw8PqtznYtg4swMk7Yjj89Tsj23u5CJLfW5Bk8ro4G1s"),
    fimbulbyosbutch: new PublicKey("BBUTCn3jcXKjFYuuYtY8MNo8bDg9VsZaKwaSYnRr2Qse"),
    fimbulecosunibomba: new PublicKey("9zrgra3XQkZPt8XNs4fowbqmj7B8bBx76aEmsKSnm9BW"),
    pearcer6: new PublicKey("Fys8J53cquYsg5zYfeZStVGNwM9FopFw8QFkiE9CCR1J"),
    fimbulmambaex: new PublicKey("MEXfyQHowwqoTHsN6yjfeXVaxZxALUFJAHuzY8gFiUu")
};

export interface RecipeToKey {
    [key: string]: string;
}

export const RECIPE_TO_KEY: RecipeToKey = {
    'fuel': 'Fuel',
    'Food': 'food',
    'ammo': 'Ammunition',
    'Ammunition': 'ammo',
    'Fuel': 'fuel',
    'Toolkit 1': 'tool',
    'Golden Ticket': 'goldenticket',
    'Energy Substrate': 'energysubstrate',
    'Electromagnet': 'electromagnet',
    'Framework 1': 'framework',
    'Power Source': 'powersource',
    'Particle Accelerator': 'particleaccelerator',
    'Radiation Absorber': 'radiationabsorber',
    'Super Conductor': 'superconductor',
    'Strange Emitter': 'strangeemitter',
    'Crystal Lattice 1': 'crystallattice',
    'Crystal Lattice 2': 'crystallattice2',
    'Crystal Lattice 3': 'crystallattice3',
    'Copper Wire': 'copperwire',
    'Copper': 'copper',
    'Electronics': 'electronics',
    'Graphene': 'graphene',
    'Hydrocarbon': 'hydrocarbon',
    'Iron': 'iron',
    'Magnet': 'magnet',
    'Polymer': 'polymer',
    'Steel': 'steel',
    'Council RFR': 'councilrfr',
    'Calico Maxhog': 'calicomaxhog',
    'Fimbul Airbike': 'fimbulairbike',
    'Toolkit 2': 'tool',
    'Framework 2': 'framework',
    'Fimbul BYOS Butch': 'fimbulbyosbutch',
    'Fimbul ECOS Unibomba': 'fimbulecosunibomba',
    'Pearce R6': 'pearcer6',
    'Fimbul Mamba Ex': 'fimbulmambaex'

};


export const SDU_TRACKER=new PublicKey("EJ74A2vb3HFhaEh4HqdejPpQoBjnyEctotcx1WudChwj");