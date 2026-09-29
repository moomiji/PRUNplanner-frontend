<script setup lang="ts">
	import {
		computed,
		type ComputedRef,
		type PropType,
		type Ref,
		ref,
		watch,
	} from "vue";

	import { useI18n } from "vue-i18n";
	const { t } = useI18n();

	// Composables
	import { usePrice } from "@/features/cx/usePrice";
	import { useRepairAnalysis } from "@/features/repair_analysis/useRepairAnalysis";

	// Util
	import {
		calculateRepairCurve,
		findOptimalRepairDay,
		repairCostSeries,
	} from "@/features/repair_analysis/repairAnalysis.util";

	// Components
	import DayRepairMaterialTable from "@/features/repair_analysis/components/DayRepairMaterialTable.vue";
	import XITTransferActionButton from "@/features/xit/components/XITTransferActionButton.vue";
	import PlanRepairProfitChart from "@/ui/charts/PlanRepairProfitChart.vue";
	import PlanRepairCostChart from "@/ui/charts/PlanRepairCostChart.vue";

	// Types & Interfaces
	import type {
		IPlanRepairAnalysisDataProp,
		IPlanRepairAnalysisElement,
	} from "@/features/planning/components/tools/planRepairAnalysis.types";
	import type { PSelectOption } from "@/ui/ui.types";
	import type { IMaterialIO } from "@/features/planning/usePlanCalculation.types";

	// UI
	import { PForm, PFormItem, PSelect } from "@/ui";

	const props = defineProps({
		data: {
			type: Array as PropType<IPlanRepairAnalysisDataProp[]>,
			required: true,
		},
		cxUuid: {
			type: String,
			required: false,
			default: undefined,
		},
		planetNaturalId: {
			type: String,
			required: false,
			default: undefined,
		},
	});

	// Local State
	const localData = computed(() => props.data);
	const localCxUuid = computed(() => props.cxUuid);
	const localPlanetNaturalId = computed(() => props.planetNaturalId);
	const ALL_BUILDINGS = "all-buildings" as const;

	const selectionOptions: ComputedRef<PSelectOption[]> = computed(() => {
		const options: PSelectOption[] = localData.value.map((b, i) => ({
			label: b.name,
			value: i,
		}));
		if (localData.value.length > 0)
			options.push({
				label: t("plan.tools.repair_analysis.graph.all_buildings"),
				value: ALL_BUILDINGS,
			});
		return options;
	});

	const selectedBuilding = ref<number | typeof ALL_BUILDINGS | undefined>(
		localData.value.length > 0 ? 0 : undefined
	);
	const selectedDay = ref(90);
	const repairAnalysisElements = ref<IPlanRepairAnalysisElement[]>([]);
	const allBuildingsRepairAnalysisElements =
		ref<IPlanRepairAnalysisElement[]>([]);
	const dailyRepairMaterials: Ref<Record<number, IMaterialIO[]>> = ref({});
	const repairPrices = ref<Record<string, number>>({});

	const { getPrice } = usePrice(localCxUuid, localPlanetNaturalId);
	const { calculateDailyRepairMaterials, daySelectOptions } =
		useRepairAnalysis(localCxUuid, localPlanetNaturalId);

	function calculateRep(
		buildings: IPlanRepairAnalysisDataProp[],
		prices: Record<string, number>,
		scaleRepairByAmount = false
	): IPlanRepairAnalysisElement[] {
		if (!buildings.length) return [];

		const curves = buildings.map((building) => {
			// dailyRevenue is the building type's total after workforce and
			// construction amortization have been subtracted.
			const workforceCost = -building.workforceDailyCost;
			const productionValue =
				building.amount > 0
					? building.dailyRevenue / building.amount +
						workforceCost -
						building.constructionCost / 180
					: 0;

			return calculateRepairCurve(
				productionValue,
				workforceCost,
				building.constructionMaterials,
				prices
			);
		});
		if (!scaleRepairByAmount && curves.length === 1) return curves[0];

		const combined = curves[0].map((_, day) => {
			let dailyRevenue = 0;
			let dailyRevenue_integral = 0;
			let dailyRevenue_norm = 0;
			let workforceCost = 0;
			let repair = 0;
			let dailyRepair = 0;
			const materialsByTicker = new Map<string, number>();

			curves.forEach((curve, index) => {
				const element = curve[day];
				const amount = scaleRepairByAmount
					? buildings[index].amount
					: 1;
				dailyRevenue += element.dailyRevenue * amount;
				dailyRevenue_integral +=
					element.dailyRevenue_integral * amount;
				dailyRevenue_norm += element.dailyRevenue_norm * amount;
				workforceCost +=
					-buildings[index].workforceDailyCost * amount;
				repair += element.repair * amount;
				dailyRepair += element.dailyRepair * amount;
				element.materials.forEach((material) => {
					materialsByTicker.set(
						material.ticker,
						(materialsByTicker.get(material.ticker) ?? 0) +
							material.amount * amount
					);
				});
			});

			return {
				...curves[0][day],
				dailyRevenue,
				dailyRevenue_integral,
				dailyRevenue_norm,
				materials: Array.from(
					materialsByTicker,
					([ticker, amount]) => ({ ticker, amount })
				),
				repair,
				dailyRepair,
				profit:
					day === 0
						? 0
						: dailyRevenue_norm - workforceCost - repair,
			};
		});

		if (combined.length > 1) combined[0].profit = combined[1].profit;
		return combined;
	}

	const displayedRepairAnalysisElements = computed(() =>
		selectedBuilding.value === ALL_BUILDINGS
			? allBuildingsRepairAnalysisElements.value
			: repairAnalysisElements.value
	);
	const optimalDay = computed(() =>
		findOptimalRepairDay(displayedRepairAnalysisElements.value)
	);
	const singleMat = computed(() =>
		repairCostSeries(
			displayedRepairAnalysisElements.value,
			repairPrices.value
		)
	);

	const selectPlanTransferMaterials = computed(() => {
		if (
			!dailyRepairMaterials.value ||
			!dailyRepairMaterials.value[selectedDay.value]
		)
			return [];

		return dailyRepairMaterials.value[selectedDay.value].map((e) => ({
			ticker: e.ticker,
			value: e.input,
		}));
	});

	// Recalculate whenever selectedBuilding or localData changes
	watch(
		[selectedBuilding, localData],
		async () => {
			// the plan's buildings changed, keep the selection valid
			if (
				selectedBuilding.value !== ALL_BUILDINGS &&
				!localData.value[selectedBuilding.value ?? -1]
			)
				selectedBuilding.value =
					localData.value.length > 0 ? 0 : undefined;

			try {
				const tickers = new Set(
					localData.value.flatMap((building) =>
						building.constructionMaterials.map(
							(material) => material.ticker
						)
					)
				);
				const prices: Record<string, number> = Object.fromEntries(
					await Promise.all(
						Array.from(tickers, async (ticker) => [
							ticker,
							await getPrice(ticker, "BUY"),
						] as const)
					)
				);
				repairPrices.value = prices;

				const selected =
					selectedBuilding.value === ALL_BUILDINGS
						? localData.value
						: typeof selectedBuilding.value === "number"
							? [localData.value[selectedBuilding.value]]
							: [];
				repairAnalysisElements.value = calculateRep(
					selected,
					prices,
					true
				);
				allBuildingsRepairAnalysisElements.value = calculateRep(
					localData.value,
					prices,
					true
				);
				dailyRepairMaterials.value =
					await calculateDailyRepairMaterials(localData.value);
			} catch (err) {
				console.error(err);
			}
		},
		{
			deep: true,
			immediate: true,
		}
	);
</script>

<template>
	<h2 class="pb-3 text-white/80 font-bold text-lg">
		{{ $t("plan.tools.repair_analysis.title") }}
	</h2>
	<div class="grid grid-cols-1 xl:grid-cols-[400px_auto] gap-3 gap-x-6">
		<div>
			<h2 class="font-bold pb-3">
				{{ $t("plan.tools.repair_analysis.plan") }}
			</h2>

			<PForm>
				<PFormItem
					:label="t('plan.tools.repair_analysis.table.select_day')">
					<div class="w-full flex flex-row justify-between">
						<PSelect
							v-model:value="selectedDay"
							:options="daySelectOptions"
							searchable
							class="w-1/2 max-w-50" />

						<XITTransferActionButton
							:elements="selectPlanTransferMaterials" />
					</div>
				</PFormItem>
			</PForm>

			<div class="py-3">
				<DayRepairMaterialTable
					v-if="
						dailyRepairMaterials &&
						dailyRepairMaterials[selectedDay]
					"
					:materials="dailyRepairMaterials[selectedDay]" />
			</div>
		</div>
		<div>
			<h2 class="font-bold pb-3">
				{{ $t("plan.tools.repair_analysis.graph.individual_building") }}
			</h2>
			<PForm>
				<PFormItem
					:label="
						t('plan.tools.repair_analysis.graph.select_building')
					">
					<PSelect
						v-model:value="selectedBuilding"
						:options="selectionOptions"
						class="w-1/2 max-w-50" />
				</PFormItem>
			</PForm>

			<template v-if="localData.length > 0">
				<div>
					<h2 class="font-bold py-3">Profit Curve</h2>
					<PlanRepairProfitChart
						:profit-data="
							displayedRepairAnalysisElements.map((r) => r.profit)
						"
						:optimal-point="{
							x: optimalDay.day,
							y: optimalDay.profit,
						}" />
				</div>
				<div>
					<h2 class="font-bold pb-3">
						{{
							$t(
								"plan.tools.repair_analysis.graph.repair_cost_breakdown"
							)
						}}
					</h2>
					<PlanRepairCostChart
						:series="
							[
								{
									name: 'Total Cost',
									data: displayedRepairAnalysisElements.map(
										(r) => r.dailyRepair
									),
								},
								{
									name: 'Total Cost/Day',
									data: displayedRepairAnalysisElements.map(
										(r) => r.repair
									),
								},
							].concat(singleMat)
						" />
				</div>
			</template>
		</div>
	</div>
</template>
