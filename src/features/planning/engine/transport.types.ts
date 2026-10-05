export type TransportDirection = "import" | "export";

export interface ITransportShipType {
	key: string;
	weight: number;
	volume: number;
}

export interface ITransportFlow {
	// days between visits the ship can carry, Infinity without any flow
	days: number;
	// what lies in the cargo bay, without SF held by the fuel tanks
	loadWeight: number;
	loadVolume: number;
	// units of fuel held by the fuel tanks, by fuel ticker
	tankLoads: Record<string, number>;
}
