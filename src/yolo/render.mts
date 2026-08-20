// Render boxes and mask to image, for testing only
import p from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import OpenComicAI from '../index.mjs';

import yolo, {Detection} from '../yolo.mjs';

export interface RenderOptions {
	input?: boolean;
	mask?: boolean | {transparent?: boolean};
	overlay?: boolean | {opacity?: number};
	overlayMask?: boolean | {opacity?: number};
	path?: boolean | {opacity?: number};
	result?: boolean;
}

export default async function render(dest: string, detection: Detection, options: RenderOptions): Promise<void> {

	if(!fs.existsSync(dest))
		await fsp.mkdir(dest);

	// Delete previous files
	const files = await fsp.readdir(dest);

	for(const file of files)
	{
		if(/^(?:yolo-input|mask\-[\d]+|overlay|overlay-mask|path|result)\.(?:png|svg)$/.test(file) && options.input)
			await fsp.unlink(p.join(dest, file));
	}

	const [modelWidth, modelHeight] = [detection.width, detection.height];
	const [finalWidth, finalHeight] = detection.matchInputSize ? [detection.originalWidth, detection.originalHeight] : [detection.width, detection.height];
	const opacity = 0.5;

	// Input
	if(options.input)
	{
		const image = await OpenComicAI.sharp(detection.image).resize(modelWidth, modelHeight, {fit: 'contain', kernel: 'lanczos3', position: 'left top'}).png().raw().toBuffer();
		await OpenComicAI.sharp(image, {raw: {width: modelWidth, height: modelHeight, channels: 3}}).toFile(p.join(dest, 'yolo-input.png'));
	}

	// Mask
	if(options.mask)
	{
		for(let i = 0, len = detection.boxes.length; i < len; i++)
		{
			const box = detection.boxes[i];

			let _sharp = OpenComicAI.sharp(Buffer.from(box.mask), {raw: {width: box.width, height: box.height, channels: 1}});

			if(options.mask !== true && options.mask?.transparent)
			{
				_sharp = OpenComicAI.sharp({
					create: {
						width: box.width,
						height: box.height,
						channels: 3,
						background: {r: 255, g: 255, b: 255},
					},
				}).joinChannel(await _sharp.png().toBuffer());
			}

			await _sharp.resize(finalWidth, finalHeight, {fit: 'fill', kernel: 'nearest'}).png().toFile(p.join(dest, `mask-${i}.png`));
		}
	}

	// Overlay
	let overlay;

	if(options.overlay || options.result)
	{
		const _opacity = (typeof options.overlay === 'object' ? options.overlay.opacity : undefined) ?? opacity;
		const svgElements = [];

		for(let i = 0, len = detection.boxes.length; i < len; i++)
		{
			const det = detection.boxes[i];
			const [x1, y1, x2, y2] = det.box;
			const width = x2 - x1;
			const height = y2 - y1;

			const color = colorHex(i);

			svgElements.push(`<rect x="${x1}" y="${y1}" width="${width}" height="${height}" fill="none" stroke="${color}" stroke-width="2"/>`);

			const label = `${det.label} ${(det.probability * 100).toFixed(1)}%`;
			const fontSize = Math.max(16, Math.min(width / 8, 16));
			const padding = 6;
			const labelWidth = label.length * fontSize * 0.6;
			const labelHeight = fontSize + padding * 2;

			svgElements.push(`<rect x="${x1}" y="${Math.max(0, y1 - labelHeight)}" width="${labelWidth}" height="${labelHeight}" fill="${color}" opacity="${_opacity}"/>`);
			svgElements.push(`<text x="${x1 + padding}" y="${Math.max(fontSize, y1 - padding)}"  font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white">${label}</text>`);
		}

		overlay = `
			<svg width="${finalWidth}" height="${finalHeight}">
				${svgElements.join('\n')}
			</svg>
		`;

		if(options.overlay)
    		await fsp.writeFile(p.join(dest, `overlay.svg`), overlay);
	}

	// Overlay mask
	let overlayMask;

	if(options.overlayMask || options.result)
	{
		const _opacity = (typeof options.overlayMask === 'object' ? options.overlayMask.opacity : undefined) ?? opacity;

		overlayMask = OpenComicAI.sharp({
			create: {
				width: finalWidth,
				height: finalHeight,
				channels: 4,
				background: {r: 255, g: 255, b: 255, alpha: 0},
			},
		});

		const composites = [];

		for(let i = 0, len = detection.boxes.length; i < len; i++)
		{
			const color = colorHex(i);
			const {r, g, b} = hexToRgb(color);
			const box = detection.boxes[i];

			const mask = OpenComicAI.sharp(Buffer.from(box.mask), {
				raw: {
					width: box.width,
					height: box.height, 
					channels: 1,
				},
			}).linear(_opacity, 0).resize(finalWidth, finalHeight, {fit: 'fill', kernel: 'nearest'});

			const coloredMask = await OpenComicAI.sharp({
				create: {
					width: finalWidth,
					height: finalHeight,
					channels: 3,
					background: {r, g, b},
				},
			}).joinChannel(await mask.png().toBuffer()).png().toBuffer();

			composites.push({
				input: coloredMask,
				left: 0,
				top: 0,
			});
		}

		if(options.overlayMask)
			await overlayMask.composite(composites).png().toFile(p.join(dest, `overlay-mask.png`));
	}

	// Path
	if(options.path)
	{
		const _opacity = (typeof options.path === 'object' ? options.path.opacity : undefined) ?? opacity;
		const svgElements = [];

		for(let i = 0, len = detection.boxes.length; i < len; i++)
		{
			const box = detection.boxes[i];
			const color = colorHex(i);

			if(box.path)
				svgElements.push(`<path d="${box.path}" fill="rgba(255, 255, 255, ${_opacity})" stroke="${color}" stroke-width="2"/>`);
		}

		const svg = `
			<svg width="${finalWidth}" height="${finalHeight}">
				${svgElements.join('\n')}
			</svg>
		`;

		await fsp.writeFile(p.join(dest, `path.svg`), svg);
	}

	// Result (image + overlay + overlayMask)
	if(options.result)
	{
		let result = OpenComicAI.sharp(detection.image).resize(finalWidth, finalHeight, {fit: 'contain', kernel: 'lanczos3', position: 'left top'});

		const composites = [];

		if(overlayMask)
			composites.push({input: await overlayMask.png().toBuffer(), blend: 'over'});

		if(overlay)
			composites.push({input: Buffer.from(overlay), blend: 'over'});

		await result.composite(composites).png().toFile(p.join(dest, `result.png`));
	}

}

function colorHex(index: number) {

	const palette = [
		'#FF3838',
		'#FF9D97',
		'#FF701F',
		'#FFB21D',
		'#CFD231',
		'#48F90A',
		'#92CC17',
		'#3DDB86',
		'#1A9334',
		'#00D4BB',
		'#2C99A8',
		'#00C2FF',
		'#344593',
		'#6473FF',
		'#0018EC',
		'#8438FF',
		'#520085',
		'#CB38FF',
		'#FF95C8',
		'#FF37C7',
	];

	index = index % palette.length;
	return palette[index];

}

function hexToRgb(hex: string) {

	const n = parseInt(hex.replace('#', ''), 16);
	return {
		r: (n >> 16) & 255,
		g: (n >> 8) & 255,
		b: n & 255,
	};

}