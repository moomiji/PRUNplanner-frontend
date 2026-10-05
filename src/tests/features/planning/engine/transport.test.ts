import { describe, it, expect } from "vitest";

import { calculateTransportFlow } from "@/features/planning/engine/transport";

import type { IMaterialIO } from "@/features/planning/usePlanCalculation.types";

function io(
	ticker: string,
	delta: number,
	unitWeight: number,
	unitVolume: number
): IMaterialIO {
	return {
		ticker,
		input: delta < 0 ? -delta : 0,
		output: delta > 0 ? delta : 0,
		delta,
		price: 0,
		individualWeight: unitWeight,
		individualVolume: unitVolume,
		totalWeight: delta * unitWeight,
		totalVolume: delta * unitVolume,
	};
}

describe("calculateTransportFlow", () => {
	it("limits the interval by the tighter of weight and volume", () => {
		// 10 t and 5 m³ per day against 100 t / 100 m³
		const flow = calculateTransportFlow(
			100,
			100,
			{},
			[io("FE", 10, 1, 0.5)],
			"export"
		);
		expect(flow.days).toBe(10);
		expect(flow.loadWeight).toBe(100);
		expect(flow.loadVolume).toBe(50);
	});

	it("separates import from export", () => {
		const materials = [io("RAT", -10, 1, 1), io("FE", 5, 1, 1)];
		expect(
			calculateTransportFlow(100, 100, {}, materials, "import").days
		).toBe(10);
		expect(
			calculateTransportFlow(100, 100, {}, materials, "export").days
		).toBe(20);
	});

	it("has no interval without flow", () => {
		const flow = calculateTransportFlow(100, 100, {}, [], "import");
		expect(flow.days).toBe(Infinity);
	});

	it("lets fuel tanks absorb their fuel before the cargo bay", () => {
		// 10 SF per day at 1 t / 1 m³, a tank of 100 units
		const sf = [io("SF", -10, 1, 1)];
		expect(
			calculateTransportFlow(100, 100, { SF: 100 }, sf, "import").days
		).toBe(20);
		expect(
			calculateTransportFlow(100, 100, { SF: 0 }, sf, "import").days
		).toBe(10);

		// at 20 days the tank holds 100 units, the bay the other 100 t
		const flow = calculateTransportFlow(100, 100, { SF: 100 }, sf, "import");
		expect(flow.tankLoads.SF).toBe(100);
		expect(flow.loadWeight).toBe(100);
		expect(flow.loadVolume).toBe(100);
	});

	it("keeps SF and FF tanks apart", () => {
		// only the FF tank is fitted, so SF fills the bay at 10 t per day
		const fuels = [io("SF", -10, 1, 1), io("FF", -10, 1, 1)];
		const flow = calculateTransportFlow(
			100,
			100,
			{ SF: 0, FF: 1000 },
			fuels,
			"import"
		);
		expect(flow.days).toBe(10);
		expect(flow.tankLoads.FF).toBe(100);
		expect(flow.loadWeight).toBe(100);
	});

	it("only keeps the tanks for their fuel", () => {
		const materials = [io("RAT", -10, 1, 1)];
		expect(
			calculateTransportFlow(100, 100, { SF: 1000 }, materials, "import")
				.days
		).toBe(10);
	});
});
