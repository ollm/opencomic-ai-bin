import OpenComicAI, {type OpenComicAIOptions} from './index.mjs';

import {getArg} from './args.mjs';

const forceModel = getArg('--model');
const onlyOpenComic = getArg('--only-opencomic');
const tileSize = getArg('--tile-size');

(async function(){

	console.log('Calculating latency for available models...');

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
		if(onlyOpenComic && !_model.startsWith('opencomic-'))
			continue;

		const model = OpenComicAI.model(_model);
		let scale = model.scales[model.scales.length - 1] ?? 4;
		if(scale > 4) scale = 4;

		const options: OpenComicAIOptions = {
			model: _model,
			scale: scale,
		};

		if(tileSize)
			options.tileSize = tileSize;

		let startTime = Date.now();

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

		for(let i = 0, len = images.length; i < len; i++)
		{
			const image = images[i];

			console.time(`Processing image ${i + 1}/${len} for model: ${model.name}`);

			await OpenComicAI.pipeline(image, '../assets/calculate-latency_'+_model+'.jpg', [
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

			if(ignoreFirst && i === 0)
				startTime = Date.now();
		}

		const endTime = Date.now();
		const latency = endTime - startTime;
		console.log(`Model: ${model.name}, Latency: ${latency} ms`);
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