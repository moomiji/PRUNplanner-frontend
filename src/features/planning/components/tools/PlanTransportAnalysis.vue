<script setup lang="ts">
	import { computed, type ComputedRef, type PropType, ref, type Ref } from "vue";

	import { useI18n } from "vue-i18n";
	const { t } = useI18n();

	// Engine
	import { calculateTransportFlow } from "@/features/planning/engine/transport";
	import {
		TRANSPORT_FTL_TANKS,
		TRANSPORT_SHIP_TYPES,
		TRANSPORT_STL_TANKS,
	} from "@/features/planning/engine/transport.constants";

	// Util
	import { formatAmount, formatNumber } from "@/util/numbers";

	// Types & Interfaces
	import type { PSelectOption } from "@/ui/ui.types";
	import type { IMaterialIO } from "@/features/planning/usePlanCalculation.types";
	import type { ITransportFlow } from "@/features/planning/engine/transport.types";

	type MaterialGroup = "production" | "workforce";

	interface ITransportShip {
		id: number;
		type: string;
		stl: number;
		ftl: number;
		groups: MaterialGroup[];
		include: string[];
		exclude: string[];
	}

	// UI
	import { PButton, PSelect, PSelectMultiple, PTable } from "@/ui";

	const props = defineProps({
		materialIO: {
			type: Array as PropType<IMaterialIO[]>,
			required: true,
		},
		productionMaterialIO: {
			type: Array as PropType<IMaterialIO[]>,
			required: true,
		},
		workforceMaterialIO: {
			type: Array as PropType<IMaterialIO[]>,
			required: true,
		},
	});

	// Local State, never persisted
	const ships: Ref<ITransportShip[]> = ref([]);
	const newType: Ref<string> = ref(TRANSPORT_SHIP_TYPES[0].key);
	let nextId: number = 1;

	const shipTypeOptions: PSelectOption[] = TRANSPORT_SHIP_TYPES.map((s) => ({
		label: `${s.key} (${formatAmount(s.weight)} t / ${formatAmount(s.volume)} m³)`,
		value: s.key,
	}));

	function tankOptions(sizes: number[]): PSelectOption[] {
		return [
			{ label: t("plan.tools.transport_analysis.tank_none"), value: 0 },
			...sizes.map((s) => ({ label: formatAmount(s), value: s })),
		];
	}
	const stlOptions: PSelectOption[] = tankOptions(TRANSPORT_STL_TANKS);
	const ftlOptions: PSelectOption[] = tankOptions(TRANSPORT_FTL_TANKS);

	const materialOptions: ComputedRef<PSelectOption[]> = computed(() =>
		props.materialIO.map((m) => ({ label: m.ticker, value: m.ticker }))
	);

	function groupTickers(group: MaterialGroup): string[] {
		return (
			group === "production"
				? props.productionMaterialIO
				: props.workforceMaterialIO
		).map((m) => m.ticker);
	}

	function effectiveTickers(ship: ITransportShip): Set<string> {
		const set = new Set<string>(ship.include);
		ship.groups.forEach((g) => groupTickers(g).forEach((x) => set.add(x)));
		ship.exclude.forEach((x) => set.delete(x));
		return set;
	}

	// a material is carried by the first ship claiming it
	const assignments: ComputedRef<Map<number, string[]>> = computed(() => {
		const taken = new Set<string>();
		const available = new Set<string>(props.materialIO.map((m) => m.ticker));
		const result = new Map<number, string[]>();
		for (const ship of ships.value) {
			const own: string[] = [...effectiveTickers(ship)].filter(
				(x) => available.has(x) && !taken.has(x)
			);
			own.forEach((x) => taken.add(x));
			result.set(ship.id, own);
		}
		return result;
	});

	const unassignedCount: ComputedRef<number> = computed(() => {
		const taken = new Set<string>();
		assignments.value.forEach((l) => l.forEach((x) => taken.add(x)));
		return props.materialIO.filter((m) => !taken.has(m.ticker)).length;
	});

	function addShip(): void {
		ships.value.push({
			id: nextId++,
			type: newType.value,
			stl: 0,
			ftl: 0,
			groups: [],
			include: [],
			exclude: [],
		});
	}

	function removeShip(id: number): void {
		ships.value = ships.value.filter((s) => s.id !== id);
	}

	/** gives tickers to one ship and takes them from all others */
	function claim(ship: ITransportShip, tickers: string[]): void {
		const current = assignments.value;
		for (const s of ships.value) {
			if (s.id === ship.id) {
				s.include = [...new Set([...s.include, ...tickers])];
				s.exclude = s.exclude.filter((x) => !tickers.includes(x));
			} else {
				const carried = new Set(current.get(s.id) ?? []);
				s.include = s.include.filter((x) => !tickers.includes(x));
				s.exclude = [
					...new Set([
						...s.exclude,
						...tickers.filter((x) => carried.has(x)),
					]),
				];
			}
		}
	}

	function toggleGroup(ship: ITransportShip, group: MaterialGroup): void {
		const tickers: string[] = groupTickers(group);
		if (ship.groups.includes(group)) {
			ship.groups = ship.groups.filter((g) => g !== group);
			ship.include = ship.include.filter((x) => !tickers.includes(x));
			ship.exclude = ship.exclude.filter((x) => !tickers.includes(x));
			return;
		}
		ships.value.forEach((s) => {
			s.groups = s.groups.filter((g) => g !== group);
		});
		claim(ship, tickers);
		ship.groups.push(group);
	}

	function updateTickers(
		ship: ITransportShip,
		value: Array<null | string | number | undefined>
	): void {
		const next = new Set(value.filter((v): v is string => typeof v === "string"));
		const previous = new Set(assignments.value.get(ship.id) ?? []);
		const added: string[] = [...next].filter((x) => !previous.has(x));
		const removed: string[] = [...previous].filter((x) => !next.has(x));

		claim(ship, added);
		ship.include = ship.include.filter((x) => !removed.includes(x));
		ship.exclude = [...new Set([...ship.exclude, ...removed])];
	}

	function selectedTickers(ship: ITransportShip): string[] {
		return assignments.value.get(ship.id) ?? [];
	}

	interface ITransportRow {
		ship: ITransportShip;
		weight: number;
		volume: number;
		exportFlow: ITransportFlow;
		importFlow: ITransportFlow;
	}

	const rows: ComputedRef<ITransportRow[]> = computed(() =>
		ships.value.map((ship) => {
			const type = TRANSPORT_SHIP_TYPES.find((s) => s.key === ship.type)!;
			const tickers = new Set(assignments.value.get(ship.id) ?? []);
			const materials = props.materialIO.filter((m) =>
				tickers.has(m.ticker)
			);
			const tank: number = ship.stl + ship.ftl;
			return {
				ship,
				weight: type.weight,
				volume: type.volume,
				exportFlow: calculateTransportFlow(
					type.weight,
					type.volume,
					tank,
					materials,
					"export"
				),
				importFlow: calculateTransportFlow(
					type.weight,
					type.volume,
					tank,
					materials,
					"import"
				),
			};
		})
	);

	function shipName(ship: ITransportShip): string {
		const same = ships.value.filter((s) => s.type === ship.type);
		return `${ship.type} #${same.indexOf(ship) + 1}`;
	}

	function formatDays(flow: ITransportFlow): string {
		return Number.isFinite(flow.days) ? formatNumber(flow.days) : "—";
	}

	function formatLoad(flow: ITransportFlow): string {
		return Number.isFinite(flow.days)
			? `${formatNumber(flow.loadWeight)} t / ${formatNumber(flow.loadVolume)} m³`
			: "—";
	}
</script>

<template>
	<h2 class="pb-3 text-white/80 font-bold text-lg">
		{{ $t("plan.tools.transport_analysis.title") }}
	</h2>

	<p class="pb-3">{{ $t("plan.tools.transport_analysis.info") }}</p>

	<div class="flex flex-row gap-3 items-end pb-3">
		<div class="w-64">
			<PSelect
				:value="newType"
				:aria-label="$t('plan.tools.transport_analysis.ship_type')"
				:options="shipTypeOptions"
				@update:value="(v) => (newType = String(v))" />
		</div>
		<PButton @click="addShip">
			{{ $t("plan.tools.transport_analysis.add_ship") }}
		</PButton>
	</div>

	<div
		v-for="ship in ships"
		:key="ship.id"
		class="border border-white/10 rounded p-3 mb-3">
		<div class="flex flex-row justify-between items-center pb-3">
			<h3 class="font-bold">{{ shipName(ship) }}</h3>
			<PButton type="error" size="sm" @click="removeShip(ship.id)">
				{{ $t("plan.tools.transport_analysis.remove_ship") }}
			</PButton>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3">
			<div>
				<p class="pb-1">
					{{ $t("plan.tools.transport_analysis.stl_tank") }}
				</p>
				<PSelect
					:value="ship.stl"
					:aria-label="$t('plan.tools.transport_analysis.stl_tank')"
					:options="stlOptions"
					@update:value="(v) => (ship.stl = Number(v ?? 0))" />
			</div>
			<div>
				<p class="pb-1">
					{{ $t("plan.tools.transport_analysis.ftl_tank") }}
				</p>
				<PSelect
					:value="ship.ftl"
					:aria-label="$t('plan.tools.transport_analysis.ftl_tank')"
					:options="ftlOptions"
					@update:value="(v) => (ship.ftl = Number(v ?? 0))" />
			</div>
		</div>

		<div class="flex flex-row gap-3 pb-3">
			<PButton
				size="sm"
				:type="ship.groups.includes('production') ? 'primary' : 'secondary'"
				@click="toggleGroup(ship, 'production')">
				{{ $t("plan.tools.transport_analysis.select_production") }}
			</PButton>
			<PButton
				size="sm"
				:type="ship.groups.includes('workforce') ? 'primary' : 'secondary'"
				@click="toggleGroup(ship, 'workforce')">
				{{ $t("plan.tools.transport_analysis.select_workforce") }}
			</PButton>
		</div>

		<PSelectMultiple
			:value="selectedTickers(ship)"
			:aria-label="$t('plan.tools.transport_analysis.materials')"
			:options="materialOptions"
			multiple
			searchable
			@update:value="(value) => updateTickers(ship, value)" />
	</div>

	<p v-if="ships.length > 0 && unassignedCount > 0" class="pb-3">
		{{
			$t("plan.tools.transport_analysis.unassigned", {
				count: unassignedCount,
			})
		}}
	</p>

	<PTable v-if="rows.length > 0" striped>
		<thead>
			<tr>
				<th>{{ $t("plan.tools.transport_analysis.table.ship") }}</th>
				<th>{{ $t("plan.tools.visitation_frequency.shipping.table.ship_weight") }}</th>
				<th>{{ $t("plan.tools.visitation_frequency.shipping.table.ship_volume") }}</th>
				<th class="text-center!">
					{{ $t("plan.tools.transport_analysis.table.export_days") }}
				</th>
				<th class="text-center!">
					{{ $t("plan.tools.transport_analysis.table.export_load") }}
				</th>
				<th class="text-center!">
					{{ $t("plan.tools.transport_analysis.table.import_days") }}
				</th>
				<th class="text-center!">
					{{ $t("plan.tools.transport_analysis.table.import_load") }}
				</th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="row in rows" :key="row.ship.id">
				<td>{{ shipName(row.ship) }}</td>
				<td>{{ formatAmount(row.weight) }}</td>
				<td>{{ formatAmount(row.volume) }}</td>
				<td class="text-center">{{ formatDays(row.exportFlow) }}</td>
				<td class="text-center">{{ formatLoad(row.exportFlow) }}</td>
				<td class="text-center">{{ formatDays(row.importFlow) }}</td>
				<td class="text-center">{{ formatLoad(row.importFlow) }}</td>
			</tr>
		</tbody>
	</PTable>
</template>
