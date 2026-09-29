<script setup lang="ts">
	import { computed } from "vue";
	import { Chart } from "vue-chartjs";
	import ChartDataLabels from "chartjs-plugin-datalabels";
	import {
		Chart as ChartJS,
		Title,
		Tooltip,
		Legend,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		LineController,
		ScatterController,
		type ChartData,
		type ChartOptions,
	} from "chart.js";

	ChartJS.register(
		Title,
		Tooltip,
		Legend,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		LineController,
		ScatterController,
		ChartDataLabels
	);

	interface SeriesData {
		name: string;
		data: number[];
	}

	const props = defineProps<{
		series: SeriesData[];
		optimalPoint?: { x: number; y: number };
	}>();

	const chartData = computed<ChartData<"line" | "scatter">>(() => {
		const maxLen = Math.max(...props.series.map((s) => s.data.length));
		const labels = Array.from({ length: maxLen }, (_, i) => i.toString());

		return {
			labels,
			datasets: [
				...props.series.map((s, index) => ({
					type: "line" as const,
					label: s.name,
					data: s.data,
					borderColor: `hsl(${(index * 137.5) % 360}, 60%, 40%)`,
					backgroundColor: `hsl(${(index * 137.5) % 360}, 60%, 40%)`,
					borderWidth: 2,
					pointRadius: 0,
					tension: 0,
				})),
				...(props.optimalPoint
					? [
							{
								type: "scatter" as const,
								label: "Lowest Cost/Day",
								data: [props.optimalPoint],
								pointStyle: "star",
								pointRadius: 5,
								pointHoverRadius: 6,
								backgroundColor: "#f59e0b",
								borderColor: "#fff",
								borderWidth: 2,
								datalabels: {
									display: true,
									align: "bottom" as const,
									anchor: "end" as const,
									offset: 10,
									color: "#fff",
									font: {
										family: "monospace",
										weight: "bold" as const,
										size: 12,
									},
									formatter: (value: { x: number; y: number }) => [
										`Day: ${value.x}`,
										`ȼ ${value.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
									],
									textAlign: "center" as const,
									padding: 6,
									backgroundColor: "rgba(0, 0, 0, 0.7)",
									borderRadius: 4,
								},
							},
						]
					: []),
			],
		};
	});

	const chartOptions: ChartOptions<"line" | "scatter"> = {
		responsive: true,
		maintainAspectRatio: false,
		interaction: {
			mode: "index",
			intersect: false,
		},
		plugins: {
			legend: {
				position: "bottom",
			},
			tooltip: {
				callbacks: {
					label: (context) => {
						let label = context.dataset.label || "";
						if (label) label += ": ";
						if (context.parsed.y !== null) {
							label += context.parsed.y.toFixed(2);
						}
						return label;
					},
				},
			},
			datalabels: {
				display: false,
			},
		},
		scales: {
			y: {
				beginAtZero: true,
				offset: false,
				border: {
					display: true,
					color: "#333",
					width: 1,
				},
				grid: {
					display: true,
					color: "#333",
				},
			},
			x: {
				offset: false,
				border: {
					display: true,
					color: "#333",
					width: 1,
				},
				grid: {
					display: true,
					color: "#333",
				},
			},
		},
	};
</script>

<template>
	<div class="h-full w-full h-[300px]!">
		<Chart type="line" :data="chartData" :options="chartOptions" />
	</div>
</template>
