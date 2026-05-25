import OpenComicAI from './index.mjs';

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

	const modelsList = OpenComicAI.modelsList;
	const latencies : Record<string, number> = {};
	const latenciesList: number[] = [];

	// Test OpenComic AI upscale models
	await OpenComicAI.pipeline('../assets/sample-image-1.jpg', '../assets/oc-ai-upscale-2x.jpg', [
		{
			model: 'opencomic-ai-upscale-lite',
			scale: 2,
		}
	]);

	await OpenComicAI.pipeline('../assets/sample-image-1.jpg', '../assets/oc-ai-upscale-3x.jpg', [
		{
			model: 'opencomic-ai-upscale-lite',
			scale: 3,
		}
	]);

	await OpenComicAI.pipeline('../assets/sample-image-1.jpg', '../assets/oc-ai-upscale-4x.jpg', [
		{
			model: 'opencomic-ai-upscale-lite',
			scale: 4,
		}
	]);

	// OpenComicAI.setConcurrentDaemons(0);

	for(const _model of modelsList)
	{
		const model = OpenComicAI.model(_model);

		let startTime = Date.now();

		if(perloadFirst && OpenComicAI.concurrentDaemons > 0)
		{
			console.log('Preloading model...', model.name);
			console.time(`Preload model: ${model.name}`);

			// Preload model
			await OpenComicAI.preload([
				{
					model: _model,
					scale: 4,
				}
			]);

			console.timeEnd(`Preload model: ${model.name}`);
		}

		for(let i = 0, len = images.length; i < len; i++)
		{
			const image = images[i];

			console.time(`Processing image ${i + 1}/${len} for model: ${model.name}`);

			await OpenComicAI.pipeline(image, '../assets/calculate-latency_'+_model+'.jpg', [
				{
					model: _model,
					scale: 4,
				}
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