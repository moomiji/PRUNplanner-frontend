import type { ITransportShipType } from "@/features/planning/engine/transport.types";

export const TRANSPORT_SHIP_TYPES: ITransportShipType[] = [
	{ key: "TCB", weight: 100, volume: 100 },
	{ key: "VSC", weight: 250, volume: 250 },
	{ key: "SCB", weight: 500, volume: 500 },
	{ key: "MCB", weight: 1000, volume: 1000 },
	{ key: "LCB", weight: 2000, volume: 2000 },
	{ key: "VCB", weight: 1000, volume: 3000 },
	{ key: "WCB", weight: 3000, volume: 1000 },
	{ key: "HCB", weight: 5000, volume: 5000 },
];

// fuel tanks only hold SF, sizes are units of SF
export const TRANSPORT_STL_TANKS: number[] = [1500, 3500, 8000];
export const TRANSPORT_FTL_TANKS: number[] = [300, 800, 2000];

export const TRANSPORT_FUEL_TICKER = "SF";
