import p from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import OpenComicAI, {OpenComicAIOptions, OpenComicAIKeepBigHalftone} from '../index.mjs';

interface Image {
	data: Uint8Array;
	width: number;
	height: number;
}

interface Component {
	size: number;
	pixels: number[];
	pixelsCoord: number[][];
	color: number;
}

interface Components {
	image: Uint8Array;
	width: number;
	height: number;
	components: Component[];
};

interface Tile {
	file: string;
	left: number;
	top: number;
	width: number;
	height: number;
	pixels?: number[];
	pixelsCoord?: number[][];
}

async function loadImage(source: string): Promise<Image> {

	const {data, info} = await sharp(source).grayscale().raw().toBuffer({resolveWithObject: true});

	return {
		data: data,
		width: info.width,
		height: info.height,
	};
}

function getMaskColorsFromPeaks(peaks: number[]): number[] {

	const maskColors: number[] = new Array(256).fill(0);

	let closest = peaks[0];
	let nextClosest = peaks[1];
	let nextClosestIndex = 1;

	for(let i = 0, len = 256; i < len; i++)
	{
		maskColors[i] = closest;

		if(Math.abs(i - closest) > Math.abs(i - nextClosest))
		{
			closest = nextClosest;
			nextClosestIndex++;
			nextClosest = peaks[nextClosestIndex] ?? closest;
		}
	}

	return maskColors;
}

function histogramPeaks(histogram: Uint32Array): number[] {

	const peaks: number[] = [];

	let prevIndex = 0;
	let status: 'rising' | 'falling' = 'rising';

	for(let i = 1, len = histogram.length; i < len; i++)
	{
		const prev = histogram[prevIndex];
		const current = histogram[i];

		if(prev > current)
		{
			if(status === 'rising')
				peaks.push(prevIndex);

			status = 'falling';
		}
		else if(prev < current)
		{
			if(i === len - 1 && status === 'rising')
				peaks.push(i);

			status = 'rising';
		}

		prevIndex = i;
	}
	
	return peaks;
}

function smoothHistogram(histogram: Uint32Array, radius: number): Uint32Array {

	const length = histogram.length;
	const smoothedHistogram = new Uint32Array(length);

	for(let i = 0; i < length; i++)
	{
		let sum = 0;
		let count = 0;

		for(let j = -radius; j <= radius; j++)
		{
			const index = i + j;

			if(index >= 0 && index < length	)
			{
				sum += histogram[index];
				count++;
			}
		}

		smoothedHistogram[i] = sum / count;
	}

	return smoothedHistogram;
}

function findHighest(map: Map<number, number>, current: number): {count: number, index: number, indexNotCurrent: number} {

	let max = -Infinity;
	let index = -1;

	let max2 = -Infinity;
	let index2 = -1;

	let count = 0;	

	for(const [i, value] of map.entries())
	{
		const _i = +i;

		if(value > max)
		{
			max = value;
			index = _i;
		}

		if(value > max2 && _i !== current)
		{
			max2 = value;
			index2 = _i;
		}

		count++;
	}

	return {count, index, indexNotCurrent: index2 !== -1 ? index2 : index};
}

function removeSinglePixels(mask: Uint8Array, width: number, height: number): Uint8Array {

	const cleanedMask = new Uint8Array(mask.length);
	const neighborColors = new Map<number, number>();

	for(let y = 0; y < height; y++)
	{
		const row = y * width;

		for(let x = 0; x < width; x++)
		{
			const index = row + x;
			const color = +mask[index];

			if(color === 255)
			{
				cleanedMask[index] = color;
				continue;
			}

			neighborColors.clear();
			neighborColors.set(color, 1 + (neighborColors.get(color) ?? 0));

			for(let dy = -1; dy <= 1; dy++)
			{
				for(let dx = -1; dx <= 1; dx++)
				{
					if(dx === 0 && dy === 0)
						continue;

					const nx = x + dx;
					const ny = y + dy;

					if(nx >= 0 && nx < width && ny >= 0 && ny < height)
					{
						const color = +mask[ny * width + nx];
						neighborColors.set(color, 1 + (neighborColors.get(color) ?? 0))
					}
				}
			}

			const {count, index: mostFrequentColor, indexNotCurrent: mostFrequentColorNotCurrent} = findHighest(neighborColors, color);
			cleanedMask[index] = mostFrequentColor;

			/*
			if(count > 2)
			{
				cleanedMask[index] = mostFrequentColorNotCurrent;
			}
			else
			{
				cleanedMask[index] = mostFrequentColor;
			}
			*/
		}
	}

	return cleanedMask;
}

async function histogram(image: string, radius: number = 2): Promise<{mask: Uint8Array, width: number, height: number, peaks: number[]}> {

	console.time('Array');
	// const histogram = new Array(256).fill(0);
	const histogram = new Uint32Array(256);
	console.timeEnd('Array');

	console.time('loadImage');

	const {data, width, height} = await loadImage(image);
	console.timeEnd('loadImage');
	console.time('processImage');

	for(let i = 0, len = data.length; i < len; i++)
	{
		histogram[data[i]]++;
	}

	console.timeEnd('processImage');

	console.time('smoothHistogram');
	const smoothedHistogram = smoothHistogram(histogram, radius);
	console.timeEnd('smoothHistogram');
	console.time('histogramPeaks');
	const peaks = histogramPeaks(smoothedHistogram);
	console.timeEnd('histogramPeaks');
	console.time('getMaskColorsFromPeaks');
	const maskColorsFromPeaks = getMaskColorsFromPeaks(peaks);
	console.timeEnd('getMaskColorsFromPeaks');

	console.time('for-loop');

	const smoothedMask = new Uint8Array(data.length);

	for(let i = 0, len = data.length; i < len; i++)
	{
		const pixelValue = data[i];
		const color = maskColorsFromPeaks[pixelValue];

		smoothedMask[i] = color;
	}

	console.timeEnd('for-loop');
	console.time('removeSinglePixels');
	const removedSinglePixels = removeSinglePixels(smoothedMask, width, height);
	console.timeEnd('removeSinglePixels');
	return {mask: removedSinglePixels, width, height, peaks};
}

export function maxComponents(mask: Uint8Array, width: number, height: number, minPixels: number = 50, type: 'halftone' | 'panels' = 'halftone'): Components {

	const visited = new Uint8Array(mask.length);
	const components: Component[] = [];

	if(type === 'halftone')
	{
		for(let i = 0, len = mask.length; i < len; i++)
		{
			if(mask[i] === 255) continue;

			if(mask[i] > 0 && !visited[i])
			{
				const component = {size: 0, pixels: [] as number[], pixelsCoord: [] as number[][], color: mask[i]};
				const queue = [i];

				visited[i] = 1;

				while(queue.length > 0)
				{
					const idx = queue.pop()!;
					component.pixels.push(idx);
					component.size++;

					const x = idx % width;
					const y = Math.floor(idx / width);

					component.pixelsCoord.push([x, y]);

					// Check 4-connected neighbors
					const neighbors = [
						idx - width, // top
						idx + width, // bottom
						idx - 1,     // left
						idx + 1,     // right
					];

					for(const nIdx of neighbors)
					{
						if(nIdx >= 0 && nIdx < mask.length && mask[nIdx] === component.color && !visited[nIdx] && Math.abs((nIdx % width) - x) <= 1)
						{
							visited[nIdx] = 1;
							queue.push(nIdx);
						}
					}
				}

				components.push(component);
			}
		}
	}
	else if(type === 'panels')
	{
		for(let i = 0, len = mask.length; i < len; i++)
		{
			if(mask[i] < 127) continue;

			if(!visited[i])
			{
				const component = {size: 0, pixels: [] as number[], pixelsCoord: [] as number[][], color: mask[i]};
				const queue = [i];

				visited[i] = 1;

				while(queue.length > 0)
				{
					const idx = queue.pop()!;
					component.pixels.push(idx);
					component.size++;

					const x = idx % width;
					const y = Math.floor(idx / width);

					component.pixelsCoord.push([x, y]);

					// Check 4-connected neighbors
					const neighbors = [
						idx - width, // top
						idx + width, // bottom
						idx - 1,     // left
						idx + 1,     // right
					];

					for(const nIdx of neighbors)
					{
						if(nIdx >= 0 && nIdx < mask.length && mask[nIdx] < 127 && !visited[nIdx] && Math.abs((nIdx % width) - x) <= 1)
						{
							visited[nIdx] = 1;
							queue.push(nIdx);
						}
					}
				}

				components.push(component);
			}
		}
	}

	const filteredComponents: Component[] = components.filter(c => c.size >= minPixels);

	// Rebuild mask with only largest components
	const result = new Uint8Array(mask.length).fill(255);

	for(const component of components)
	{
		if(component.size < minPixels) continue;

		const color = component.color;

		for(const idx of component.pixels)
		{
			result[idx] = color;
		}
	}

	return {image: result, width, height, components: filteredComponents};
}

/*function filterMask(mask: Uint8Array, width: number, height: number, peaks: number[]): Uint8Array {

	const filteredMask = new Uint8Array(mask.length);

		for(let i = 0, len = mask.length; i < len; i++)
		{
			const pixelValue = mask[i];

			if(peaks.includes(pixelValue))
				filteredMask[i] = pixelValue;
			else
				filteredMask[i] = 255;
		}

	return maxComponents(filteredMask, width, height, 1);
}*/

function saveTiles(components: Components, color: number, source: string, dest: string): Tile[] {

	const boxes: {x: number, y: number, width: number, height: number, pixels: number[], pixelsCoord: number[][]}[] = [];

	// TODO: Dilate/Expand components based in minSize/color?

	for(const component of components.components)
	{
		if(component.color > color) continue;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for(const idx of component.pixels)
		{
			const x = idx % components.width;
			const y = Math.floor(idx / components.width);

			if(x < minX) minX = x;
			if(y < minY) minY = y;
			if(x > maxX) maxX = x;
			if(y > maxY) maxY = y;
		}

		boxes.push({x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels: component.pixels, pixelsCoord: component.pixelsCoord});
	}

	// Join overlapping boxes
	
	const mergedBoxes: {x: number, y: number, width: number, height: number, pixels: number[], pixelsCoord: number[][]}[] = [];

	for(const box of boxes)
	{
		let merged = false;

		for(const mBox of mergedBoxes)
		{
			if(box.x < mBox.x + mBox.width && box.x + box.width > mBox.x &&
			   box.y < mBox.y + mBox.height && box.y + box.height > mBox.y)
			{
				const minX = Math.min(mBox.x, box.x);
				const minY = Math.min(mBox.y, box.y);
				const maxX = Math.max(mBox.x + mBox.width, box.x + box.width);
				const maxY = Math.max(mBox.y + mBox.height, box.y + box.height);

				mBox.x = minX;
				mBox.y = minY;
				mBox.width = maxX - minX;
				mBox.height = maxY - minY;
				mBox.pixels = mBox.pixels.concat(box.pixels);
				merged = true;
				break;
			}
		}

		if(!merged)
			mergedBoxes.push(box);
	}

	const tiles: Tile[] = [];

	for(const [index, box] of mergedBoxes.entries())
	{
		const tileDest = OpenComicAI.intermediateDest(dest)
		sharp(source).extract({left: box.x, top: box.y, width: box.width, height: box.height}).toFile(tileDest);

		tiles.push({
			file: tileDest,
			left: box.x,
			top: box.y,
			width: box.width,
			height: box.height,
			pixels: box.pixels,
			pixelsCoord: box.pixelsCoord,
		});
	}

	return tiles;
}

async function keep(source: string, dest: string, options: OpenComicAIKeepBigHalftone, progress?: ((progress: number) => void) | false): Promise<void> {

	console.time('keep');

	const minSize = (options.minSize ?? 1.0) / 100;

	console.time('OpenComicAI.image');
	
	const maskDest = OpenComicAI.intermediateDest(dest);
	await OpenComicAI.image(source, maskDest, options, progress);

	console.timeEnd('OpenComicAI.image');

	console.time('histogram');
	const {mask, width, height, peaks} = await histogram(maskDest, 5);
	console.timeEnd('histogram');

	console.time('maxComponents');
	const filteredMask = maxComponents(mask, width, height, options.minPixels ?? 50);
	console.timeEnd('maxComponents');

	// DEBUG
	await sharp(filteredMask.image, {raw: {width, height, channels: 1}}).png().toFile(OpenComicAI.intermediateDest(dest));

	const color = 255 - Math.round(height * minSize);

	// console.log(color);
	console.log(color); // 19.99 is 28.00 in krita, aprox?

	if(options.artifactRemoval)
	{
		const tiles = saveTiles(filteredMask, color, source, dest);

		console.time('tiles');

		const descreenedImage = await sharp(dest).raw().toBuffer({resolveWithObject: true});
		const channels = descreenedImage.info.channels ?? 3;

		console.log(channels);

		const {width: imageWidth, height: imageHeight} = descreenedImage.info;
		const data = descreenedImage.data;

		for(const tile of tiles)
		{
			const tileDest = OpenComicAI.intermediateDest(dest);
			await OpenComicAI.image(tile.file, tileDest, options.artifactRemoval);

			console.time('tile');

			const image = await sharp(tileDest).raw().toBuffer({resolveWithObject: true});

			// const setPixels = new Set<number>(tile.pixels);
			const pixelsCoord = tile.pixelsCoord!;

			const {left: tileLeft, top: tileTop, width: tileWidth, height: tileHeight} = tile;

			for(const [x, y] of pixelsCoord)
			{
				for(let y2 = -1; y2 <= 1; y2++)
				{
					for(let x2 = -1; x2 <= 1; x2++)
					{
						const nx = x + x2;
						const ny = y + y2;

						if(nx < 0 || nx >= imageWidth || ny < 0 || ny >= imageHeight)
							continue;

						const tx = nx - tileLeft;
						const ty = ny - tileTop;

						if(tx < 0 || tx >= tileWidth || ty < 0 || ty >= tileHeight)
							continue;

						const tyRow = ty * tileWidth;
						const iyRow = ny * imageWidth;

						const tileIndex = (tyRow + tx) * channels;
						const imageIndex = (iyRow + nx) * channels;

						for(let c = 0; c < channels; c++)
						{
							data[imageIndex + c] = image.data[tileIndex + c];
						}
					}
				}
			}

			/*
			for(let y = 0; y < tile.height; y++)
			{
				for(let x = 0; x < tile.width; x++)
				{
					const destPixelIndex = (tile.top + y) * descreenedImage.info.width + (tile.left + x);

					if(!setPixels.has(destPixelIndex))
						continue;

					const tilePixelIndex = y * tile.width + x;
					const tileIndex = tilePixelIndex * channels;
					const imageIndex = destPixelIndex * channels;

					for(let c = 0; c < channels; c++)
					{
						descreenedImage.data[imageIndex + c] = image.data[tileIndex + c];
					}
				}
			}
			*/

			console.timeEnd('tile');

			// Replace source with keep image
			await fsp.unlink(tileDest);
			await fsp.unlink(tile.file);
			// fs.renameSync(tileDest, tile.file);
		}

		const keepDest = OpenComicAI.intermediateDest(dest);

		await sharp(descreenedImage.data, {
			raw: {
				width: imageWidth,
				height: imageHeight,
				channels,
			},
		}).toFile(keepDest);

		console.timeEnd('tiles');

		await fsp.unlink(dest);
		await fsp.unlink(maskDest);
		fs.renameSync(keepDest, dest);
	}
	else
	{
		await fsp.unlink(dest);
		fs.renameSync(maskDest, dest);
	}


	/*
	// Replace source with keep image
	await fsp.unlink(source);
	fs.renameSync(maskDest, source);
	*/

	console.timeEnd('keep');
}

let sharp: any = false;

function setSharp(_sharp: any): void {

	sharp = _sharp;

}

export default {
	keep,
	histogram,
	setSharp,
	get sharp() {return sharp},
}