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

	let minPixels = options.minPixels ?? 50;

	console.time('Resize sharp');
	const dest = p.join(tempDir, 'example.png');

	const sharpDest = OpenComicAI.intermediateDest(dest);
	const panelsDest = OpenComicAI.intermediateDest(dest);

	const modelInfo = OpenComicAI.model(options.model);

	let size = modelInfo.tileSize || 512;

	const originalImage = await OpenComicAI.sharp(source);
	const {width: originalWidth, height: originalHeight} = await originalImage.metadata();

	const {data: adjustedLevelsImage, info} = await originalImage.resize({
		width: size,
		height: size,
		fit: options.keepAspectRatio !== false ? 'inside' : 'fill', // 'fill', // Use 'inside' to maintain aspect ratio, 'fill' to stretch to size and have a little more accurate detection, but needs to be converted to original aspect ratio later
	}).grayscale().raw().toBuffer({resolveWithObject: true});

	let {width, height} = info;

	// TODO: Adjust levels to enhance contrast for better detection, temporarily??
	for(let i = 0, len = adjustedLevelsImage.length; i < len; i++)
	{
		adjustedLevelsImage[i] = Math.min(255, Math.max(0, Math.round(adjustedLevelsImage[i] * 1.5)));
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

	console.timeEnd('Resize sharp');

	console.time('OpenComicAI.image');
		
	await OpenComicAI.image(sharpDest, panelsDest, options);
	await fsp.unlink(sharpDest);

	console.timeEnd('OpenComicAI.image');

	const green = await OpenComicAI.sharp(panelsDest).extractChannel('green');

	if(/inverted/.test(modelInfo.name))
		await green.negate();

	let maskBuffer: Buffer;

	if(options.upscale)
	{
		const maskDest = OpenComicAI.intermediateDest(dest);
		const upscaleDest = OpenComicAI.intermediateDest(dest);

		green.toFile(maskDest);

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

	await fsp.unlink(panelsDest);

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

	console.time('maxComponents');
	const filteredMask = maxComponents(maskBuffer, width, height, minPixels, 'panels');
	console.timeEnd('maxComponents');

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