// Types & Interfaces
import type { IMaterialIO } from "@/features/planning/usePlanCalculation.types";
import type {
	ITransportFlow,
	TransportDirection,
} from "@/features/planning/engine/transport.types";

interface IFuelFlow {
	ticker: string;
	perDay: number;
	// weight or volume of one unit
	unit: number;
	tankUnits: number;
}

/**
 * Longest interval in days a capacity holds, where each fuel first fills
 * its own tank and only then the capacity, next to `otherPerDay` of
 * everything else
 */
function solveDays(
	capacity: number,
	otherPerDay: number,
	fuels: IFuelFlow[]
): number {
	const points = fuels
		.map((f) => ({ at: f.tankUnits / f.perDay, slope: f.perDay * f.unit }))
		.sort((a, b) => a.at - b.at);

	let prev: number = 0;
	let filled: number = 0;
	let slope: number = otherPerDay;

	for (const p of points) {
		if (slope > 0 && filled + slope * (p.at - prev) >= capacity) {
			return prev + (capacity - filled) / slope;
		}
		filled += slope * (p.at - prev);
		prev = p.at;
		slope += p.slope;
	}

	return slope > 0 ? prev + (capacity - filled) / slope : Infinity;
}

/**
 * Calculates how long a ship's cargo lasts for the materials assigned to
 * it in one direction and what it carries per visit
 *
 * @param {number} weight Ship capacity in t
 * @param {number} volume Ship capacity in m³
 * @param {Record<string, number>} tanks Units of fuel the tanks hold, by fuel ticker
 * @param {IMaterialIO[]} materials Materials assigned to the ship
 * @param {TransportDirection} direction Import (delta < 0) or export
 * @returns {ITransportFlow} Visit interval and load
 */
export function calculateTransportFlow(
	weight: number,
	volume: number,
	tanks: Record<string, number>,
	materials: IMaterialIO[],
	direction: TransportDirection
): ITransportFlow {
	const sign: number = direction === "import" ? -1 : 1;
	const flowing: IMaterialIO[] = materials.filter((m) => m.delta * sign > 0);

	let otherWeight: number = 0;
	let otherVolume: number = 0;
	const fuelsWeight: IFuelFlow[] = [];
	const fuelsVolume: IFuelFlow[] = [];

	for (const m of flowing) {
		const tankUnits: number | undefined = tanks[m.ticker];
		const perDay: number = Math.abs(m.delta);
		if (tankUnits === undefined) {
			otherWeight += Math.abs(m.totalWeight);
			otherVolume += Math.abs(m.totalVolume);
		} else {
			fuelsWeight.push({
				ticker: m.ticker,
				perDay,
				unit: Math.abs(m.totalWeight) / perDay,
				tankUnits,
			});
			fuelsVolume.push({
				ticker: m.ticker,
				perDay,
				unit: Math.abs(m.totalVolume) / perDay,
				tankUnits,
			});
		}
	}

	const days: number = Math.min(
		solveDays(weight, otherWeight, fuelsWeight),
		solveDays(volume, otherVolume, fuelsVolume)
	);

	if (!Number.isFinite(days)) {
		return { days, loadWeight: 0, loadVolume: 0, tankLoads: {} };
	}

	const tankLoads: Record<string, number> = {};
	let loadWeight: number = otherWeight * days;
	let loadVolume: number = otherVolume * days;

	fuelsWeight.forEach((f, i) => {
		const units: number = f.perDay * days;
		const overflow: number = Math.max(0, units - f.tankUnits);
		tankLoads[f.ticker] = Math.min(units, f.tankUnits);
		loadWeight += overflow * f.unit;
		loadVolume += overflow * fuelsVolume[i].unit;
	});

	return { days, loadWeight, loadVolume, tankLoads };
}
