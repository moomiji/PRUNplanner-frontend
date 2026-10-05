// Constants
import { TRANSPORT_FUEL_TICKER } from "@/features/planning/engine/transport.constants";

// Types & Interfaces
import type { IMaterialIO } from "@/features/planning/usePlanCalculation.types";
import type {
	ITransportFlow,
	TransportDirection,
} from "@/features/planning/engine/transport.types";

/**
 * Longest interval in days a capacity holds, where `fuelPerDay` units of
 * fuel (`unit` each) first fill a tank of `tankUnits` and only then the
 * capacity, next to `otherPerDay` of everything else
 */
function solveDays(
	capacity: number,
	otherPerDay: number,
	fuelPerDay: number,
	unit: number,
	tankUnits: number
): number {
	const otherDays: number = otherPerDay > 0 ? capacity / otherPerDay : Infinity;
	if (fuelPerDay <= 0 || unit <= 0) return otherDays;
	if (fuelPerDay * otherDays <= tankUnits) return otherDays;
	return (
		(capacity + tankUnits * unit) / (otherPerDay + fuelPerDay * unit)
	);
}

/**
 * Calculates how long a ship's cargo lasts for the materials assigned to
 * it in one direction and what it carries per visit
 *
 * @param {number} weight Ship capacity in t
 * @param {number} volume Ship capacity in m³
 * @param {number} tankUnits Units of SF the fuel tanks add
 * @param {IMaterialIO[]} materials Materials assigned to the ship
 * @param {TransportDirection} direction Import (delta < 0) or export
 * @returns {ITransportFlow} Visit interval and load
 */
export function calculateTransportFlow(
	weight: number,
	volume: number,
	tankUnits: number,
	materials: IMaterialIO[],
	direction: TransportDirection
): ITransportFlow {
	const sign: number = direction === "import" ? -1 : 1;
	const flowing: IMaterialIO[] = materials.filter((m) => m.delta * sign > 0);

	let otherWeight: number = 0;
	let otherVolume: number = 0;
	let fuelPerDay: number = 0;
	let fuelWeight: number = 0;
	let fuelVolume: number = 0;

	for (const m of flowing) {
		if (m.ticker === TRANSPORT_FUEL_TICKER) {
			fuelPerDay += Math.abs(m.delta);
			fuelWeight += Math.abs(m.totalWeight);
			fuelVolume += Math.abs(m.totalVolume);
		} else {
			otherWeight += Math.abs(m.totalWeight);
			otherVolume += Math.abs(m.totalVolume);
		}
	}

	const unitWeight: number = fuelPerDay > 0 ? fuelWeight / fuelPerDay : 0;
	const unitVolume: number = fuelPerDay > 0 ? fuelVolume / fuelPerDay : 0;

	const days: number = Math.min(
		solveDays(weight, otherWeight, fuelPerDay, unitWeight, tankUnits),
		solveDays(volume, otherVolume, fuelPerDay, unitVolume, tankUnits)
	);

	if (!Number.isFinite(days)) {
		return { days, loadWeight: 0, loadVolume: 0 };
	}

	return {
		days,
		loadWeight: (otherWeight + fuelWeight) * days,
		loadVolume: (otherVolume + fuelVolume) * days,
	};
}
