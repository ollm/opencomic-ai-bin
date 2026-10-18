import p from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import OpenComicAI, {OpenComicAIPanels, OpenComicAIOptions, Downloading} from './index.mjs';
import {maxComponents} from './descreen/keep-big-halftone.mjs';
import fillHoles from './yolo/fill-holes.mjs';
import yolo, {Box, Detection} from './yolo.mjs';

let debug = false;
let tempDir = os.tmpdir();

async function image(source: string, options: OpenComicAIPanels, downloading?: Downloading | false): Promise<Detection> {

	const steps: OpenComicAIOptions[] = [];

	const recursiveSteps = (opts: OpenComicAIOptions | OpenComicAIPanels) => {
		steps.push(opts);

		if('upscale' in opts && opts.upscale)
			recursiveSteps(opts.upscale);
	};

	recursiveSteps(options);

	await OpenComicAI.getModels(steps, downloading);


	if(debug) console.time('Resize sharp');
	const dest = p.join(tempDir, 'example.png');

	const sharpDest = OpenComicAI.intermediateDest(dest);
	let panelsDest = OpenComicAI.intermediateDest(dest);

	const modelInfo = OpenComicAI.model(options.model);

	let size = modelInfo.tileSize || 512;
	
	// In base 512, cuadratic adjustment for minPixels
	let minPixels = options.minPixels ?? 50;
	minPixels = Math.round(minPixels * (size / 512) * (size / 512));

	const originalImage = await OpenComicAI.sharp(source);
	const {width: originalWidth, height: originalHeight} = await originalImage.metadata();

	const {data: adjustedLevelsImage, info} = await originalImage.resize({
		width: size,
		height: size,
		// fit: options.keepAspectRatio !== false ? 'inside' : 'fill', // 'fill', // Use 'inside' to maintain aspect ratio, 'fill' to stretch to size and have a little more accurate detection, but needs to be converted to original aspect ratio later
		fit: 'fill',
	}).grayscale().raw().toBuffer({resolveWithObject: true});

	let {width, height} = info;

	const imageLevels = options.imageLevels ?? {dark: 0, light: 0, smoothness: 0};

	// TODO: Adjust levels to enhance contrast for better detection, temporarily??
	// TODO: Custom arch models in principle fix this
	const {dark, light, smoothness} = imageLevels;

	if(dark > 0 || light > 0 || smoothness > 0)
	{
		const min = dark / 255;
		const max = 1 - light / 255;
		const steepness = Math.max(0.01, smoothness);

		const sigmoid = (value: number) => 1 / (1 + Math.exp(-steepness * (value - 0.5)));

		const sigmoidMin = sigmoid(0);
		const sigmoidMax = sigmoid(1);

		for(let i = 0, len = adjustedLevelsImage.length; i < len; i++)
		{
			const value = adjustedLevelsImage[i] / 255;
			const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));

			adjustedLevelsImage[i] = Math.round(
				(sigmoid(normalized) - sigmoidMin) /
				(sigmoidMax - sigmoidMin) * 255
			);
		}
	}

	await OpenComicAI.sharp(adjustedLevelsImage, {
		raw: {
			width,
			height,
			channels: 1,
		},
	}).pipelineColourspace('srgb').recomb([
		[1, 0, 0],
		[0, 0, 0], // G = 0
		[0, 0, 1],
	]).png().toFile(sharpDest);

	if(debug) console.timeEnd('Resize sharp');

	if(debug) console.time('OpenComicAI.image');
		
	await OpenComicAI.image(sharpDest, panelsDest, options);
	if(!debug) await fsp.unlink(sharpDest);

	if(debug) console.timeEnd('OpenComicAI.image');

	if(options.keepAspectRatio !== false)
	{
		const keepDest = OpenComicAI.intermediateDest(dest);

		const {width: panelsWidth, height: panelsHeight} = await OpenComicAI.sharp(panelsDest).metadata();
		const aspectRatio = originalWidth / originalHeight;
		
		const resizeWidth = Math.min(panelsWidth, Math.round(panelsHeight * aspectRatio));
		const resizeHeight = Math.min(panelsHeight, Math.round(panelsWidth / aspectRatio));

		await OpenComicAI.sharp(panelsDest).resize({
			width: resizeWidth,
			height: resizeHeight,
			fit: 'fill',
		}).toFile(keepDest);

		width = resizeWidth;
		height = resizeHeight;

		if(!debug) await fsp.unlink(panelsDest);
		panelsDest = keepDest;
	}

	const green = await OpenComicAI.sharp(panelsDest).extractChannel('green');

	if(/inverted/.test(modelInfo.name))
		await green.negate();

	let maskBuffer: Buffer;

	if(options.upscale)
	{
		const maskDest = OpenComicAI.intermediateDest(dest);
		const upscaleDest = OpenComicAI.intermediateDest(dest);

		await green.toFile(maskDest);

		await OpenComicAI.image(maskDest, upscaleDest, options.upscale);

		const upscaledImage = await OpenComicAI.sharp(upscaleDest);
		({width, height} = await upscaledImage.metadata());
	
		maskBuffer = await upscaledImage.grayscale().raw().toBuffer();
		await fsp.unlink(maskDest);
		await fsp.unlink(upscaleDest);

		const scale = (options.upscale.scale || 1);
		minPixels = minPixels * scale * scale;
	}
	else
	{
		maskBuffer = await green.raw().toBuffer();
	}

	if(!debug) await fsp.unlink(panelsDest);

	if(debug)
	{
		// DEBUG: Save the maskBuffer to a file for inspection
		await OpenComicAI.sharp(Buffer.from(maskBuffer), {
			raw: {
				width,
				height,
				channels: 1,
			},
		}).toFile(p.join(tempDir, 'mask-buffer.png'));
	}

	if(debug) console.time('maxComponents');
	const filteredMask = maxComponents(maskBuffer, width, height, minPixels, 'panels');
	if(debug) console.timeEnd('maxComponents');

	if(debug)
	{
		// DEBUG: Save the filtered mask to a file for inspection
		await OpenComicAI.sharp(Buffer.from(filteredMask.image), {
			raw: {
				width: filteredMask.width,
				height: filteredMask.height,
				channels: 1,
			},
		}).toFile(p.join(tempDir, 'filtered-mask.png'));
	}

	const boxes: Box[] = [];

	// DEBUG: Save individual components to files for inspection
	for (let i = 0; i < filteredMask.components.length; i++)
	{
		const component = filteredMask.components[i];

		let componentMask = new Uint8Array(filteredMask.width * filteredMask.height);

		const box: [number, number, number, number] = [
			component.pixelsCoord[0][0],
			component.pixelsCoord[0][1],
			component.pixelsCoord[1][0] + 1,
			component.pixelsCoord[1][1] + 1,
		];

		for(const [x, y] of component.pixelsCoord)
		{
			const idx = y * filteredMask.width + x;
			componentMask[idx] = 255; // Set the pixel to white for visualization

			if(box[0] > x) box[0] = x;
			if(box[1] > y) box[1] = y;
			if(box[2] < x + 1) box[2] = x + 1;
			if(box[3] < y + 1) box[3] = y + 1;
		}

		// Fill holes in the mask
		// if(true)
		componentMask = fillHoles(componentMask, filteredMask.width, filteredMask.height) as Uint8Array<ArrayBuffer>;

		if(debug)
		{
			// DEBUG: Save the component mask to a file for inspection
			await OpenComicAI.sharp(Buffer.from(componentMask), {
				raw: {
					width,
					height,
					channels: 1,
				},
			}).toFile(p.join(tempDir, `component-${i}.png`));
		}

		boxes.push({
			label: 'panel',
			probability: 1,
			width,
			height,
			originalWidth,
			originalHeight,
			box: box,
			mask: componentMask,
		});
	}

	return {
		image: source,
		boxes,
		width,
		height,
		originalWidth,
		originalHeight,
	};
}

export default {
	image,
	path: yolo.path,
	render: yolo.render,
	set debug(value: boolean) {debug = value},
	get debug() {return debug},
	set tempDir(dir: string) {tempDir = dir},
	get tempDir() {return tempDir},
}