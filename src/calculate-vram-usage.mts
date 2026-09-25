import fs from 'node:fs';

import OpenComicAI, {type OpenComicAIOptions} from './index.mjs';
import {getArg} from './args.mjs';

const forceModel = getArg('--model');
const tileSize = +(getArg('--tile-size') ?? 128);

const BYTES_PER_MB = 1024 ** 2;

function getCurrentVRAM() {

	return getAMDCurrentVRAM();

}

function getAvgCurrentVRAM() {

	let total = 0;

	for(let i = 0; i < 10; i++)
	{
		total += getAMDCurrentVRAM();
	}

	return total / 10;

}

function getAMDCurrentVRAM() {

	const vramUsed = parseInt(fs.readFileSync('/sys/class/drm/card1/device/mem_info_vram_used', 'utf-8'), 10);
	return vramUsed / BYTES_PER_MB;

}

(async function(){

	console.log('Calculating vram usage for available models...');

	const images = [
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		'../assets/sample-image-1.jpg',
		// '../assets/sample-image-2.jpg',
		// '../assets/sample-image-3.jpg',
	];

	OpenComicAI.setModelsPath('../assets/models');

	const ignoreFirst = false;
	const perloadFirst = true;

	const modelsList = forceModel ? [forceModel] : OpenComicAI.modelsList;
	const latencies : Record<string, number> = {};
	const latenciesList: number[] = [];

	// OpenComicAI.setConcurrentDaemons(0);

	for(const _model of modelsList)
	{
		const model = OpenComicAI.model(_model);
		let scale = model.scales[model.scales.length - 1] ?? 4;
		if(scale > 4) scale = 4;

		const options: OpenComicAIOptions = {
			model: _model,
			tileSize: tileSize,
			scale: scale,
		};

		let startTime = Date.now();

		const prevVram = getAvgCurrentVRAM();

		if(perloadFirst && OpenComicAI.concurrentDaemons > 0)
		{
			console.log('Preloading model...', model.name);
			console.time(`Preload model: ${model.name}`);

			// Preload model
			await OpenComicAI.preload([
				options,
			]);

			console.timeEnd(`Preload model: ${model.name}`);
		}

		const usageVram: number[] = [];

		for(let i = 0, len = images.length; i < len; i++)
		{
			const image = images[i];

			console.time(`Processing image ${i + 1}/${len} for model: ${model.name}`);

			await OpenComicAI.pipeline(image, '../assets/calculate-vram-usage_'+_model+'.jpg', [
				options,
			], (progress) => {

				if(progress === undefined)
					progress = 0;

				// console.log(`Processing image ${i + 1}/${len} for model: ${model.name} - ${Math.round(progress * 100)}%`);

			}, {
				start: () => {

					console.log(`Start download model: ${model.name}`);

				},
				progress: (progress) => {

					console.log(`Downloading model: ${model.name} - ${Math.round(progress * 100)}%`);

				},
				end: () => {

					console.log(`End download model: ${model.name}`);

				},
			});

			console.timeEnd(`Processing image ${i + 1}/${len} for model: ${model.name}`);

			if(i === 0)
			{
				// Sleep for a short duration to allow VRAM to stabilize
				await new Promise(resolve => setTimeout(resolve, 1000));
			}

			usageVram.push(getAvgCurrentVRAM() - prevVram);

			if(ignoreFirst && i === 0)
				startTime = Date.now();
		}

		OpenComicAI.closeAllDaemons();

		// Sleep for a short duration to allow VRAM to stabilize
		await new Promise(resolve => setTimeout(resolve, 1000));

		const avgUsageVram = Math.round((usageVram.reduce((a, b) => a + b, 0) / usageVram.length) * 10) / 10;

		const endTime = Date.now();
		const latency = endTime - startTime;
		console.log(`Model: ${model.name}, Latency: ${latency} ms, VRAM usage in tile size ${tileSize}: ${avgUsageVram}MB`);
		latencies[model.name] = latency;
		latenciesList.push(latency);
	}

	// Min latency as 0.5 value max as 10
	const minLatency = Math.min(...latenciesList);
	const maxLatency = Math.max(...latenciesList);

	for(const modelName in latencies)
	{
		const latency = latencies[modelName];
		const normalizedLatency = (latency - minLatency) / (maxLatency - minLatency);
		const scaledLatency = 0.5 + normalizedLatency * (10 - 0.5);
		latencies[modelName] = Math.round(scaledLatency * 100) / 100;
	}

	console.log('Latency calculation completed.');
	console.log('Latencies:', latencies);

})();