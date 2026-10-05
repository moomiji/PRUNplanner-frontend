<script setup lang="ts">
	import { computed, type ComputedRef, type PropType } from "vue";

	// Util
	import { formatNumber } from "@/util/numbers";

	// Constants
	import {
		TRANSPORT_FTL_FUEL,
		TRANSPORT_STL_FUEL,
	} from "@/features/planning/engine/transport.constants";

	// Types & Interfaces
	import type { ITransportFlow } from "@/features/planning/engine/transport.types";

	interface IBar {
		key: string;
		label: string;
		used: number;
		capacity: number;
		unit: string;
	}

	const props = defineProps({
		flow: {
			type: Object as PropType<ITransportFlow>,
			required: true,
		},
		weight: { type: Number, required: true },
		volume: { type: Number, required: true },
		stl: { type: Number, required: true },
		ftl: { type: Number, required: true },
	});

	const bars: ComputedRef<IBar[]> = computed(() => {
		const list: IBar[] = [
			{
				key: "weight",
				label: "plan.tools.transport_analysis.bar.weight",
				used: props.flow.loadWeight,
				capacity: props.weight,
				unit: "t",
			},
			{
				key: "volume",
				label: "plan.tools.transport_analysis.bar.volume",
				used: props.flow.loadVolume,
				capacity: props.volume,
				unit: "m³",
			},
		];
		if (props.stl > 0) {
			list.push({
				key: "stl",
				label: "plan.tools.transport_analysis.bar.stl",
				used: props.flow.tankLoads[TRANSPORT_STL_FUEL] ?? 0,
				capacity: props.stl,
				unit: TRANSPORT_STL_FUEL,
			});
		}
		if (props.ftl > 0) {
			list.push({
				key: "ftl",
				label: "plan.tools.transport_analysis.bar.ftl",
				used: props.flow.tankLoads[TRANSPORT_FTL_FUEL] ?? 0,
				capacity: props.ftl,
				unit: TRANSPORT_FTL_FUEL,
			});
		}
		return list;
	});

	function percent(bar: IBar): number {
		return bar.capacity > 0
			? Math.min(100, (bar.used / bar.capacity) * 100)
			: 0;
	}
</script>

<template>
	<div class="flex flex-col gap-1 min-w-56">
		<div v-for="bar in bars" :key="bar.key">
			<div class="flex flex-row justify-between text-xs text-white/60">
				<span>{{ $t(bar.label) }}</span>
				<span>
					{{ formatNumber(bar.used) }} /
					{{ formatNumber(bar.capacity) }} {{ bar.unit }}
				</span>
			</div>
			<div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
				<div
					class="h-full bg-prunplanner"
					:style="{ width: percent(bar) + '%' }"></div>
			</div>
		</div>
	</div>
</template>
