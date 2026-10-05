export type TransportDirection = "import" | "export";

export interface ITransportShipType {
	key: string;
	weight: number;
	volume: number;
}

export interface ITransportFlow {
	// days between visits the ship can carry, Infinity without any flow
	days: number;
	loadWeight: number;
	loadVolume: number;
}
