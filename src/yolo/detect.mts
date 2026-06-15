import {InferenceSession, Tensor} from 'onnxruntime-node';
import sharp, {ModelSession, Yolo, Box} from '../yolo.mjs';
import fs from 'fs/promises';
import _fs from 'fs';
import p from 'path';

import fillHoles from './fill-holes.mjs';

export default async function detect(source: string, session: ModelSession, _yolo: Yolo): Promise<{boxes: Box[], width: number, height: number}> {

	const yolo = {
		topk: 0,
		scoreThreshold: 0.5,
		..._yolo,
	};

	const mask = {
		threshold: 0.5,
		minArea: 0,
		scale: 1,
		baseScale: 'model',
		cropToBox: true,
		fillHoles: true,
		maxComponents: 1,
		...yolo.mask,
	};

	const inputShape = yolo.inputShape;
	const [modelWidth, modelHeight] = inputShape.slice(2);
	const maxSize = Math.max(modelWidth, modelHeight);

	const numClass = yolo.labels.length;

	const _sharp = sharp.sharp(source);
	const metadata = await _sharp.metadata();
	const channels = metadata.channels || 3;

	const imageWidth = metadata.width || 0;
	const imageHeight = metadata.height || 0;

	const imageMaxSize = Math.max(imageWidth, imageHeight);

	const finalMaskScale = mask.baseScale === 'image' ? (imageMaxSize / maxSize * mask.scale) : mask.scale;

	const aspectRatio = imageWidth / imageHeight;

	const xRatio = aspectRatio > 1 ? 1 : imageHeight / imageWidth;
	const yRatio = aspectRatio > 1 ? imageWidth / imageHeight : 1;

	const image = await _sharp.resize(modelWidth, modelHeight, {fit: 'contain', kernel: 'lanczos3', position: 'left top'}).png().raw().toBuffer();

	const pixelCount = modelWidth * modelHeight;
	const imageFloat32 = new Float32Array(modelWidth * modelHeight * 3);

	for(let i = 0; i < pixelCount; i++)
	{
		const idx = i * channels;

		const r = image[idx];
		const g = image[idx + 1];
		const b = image[idx + 2];

		imageFloat32[i] = r / 255;
		imageFloat32[i + pixelCount] = g / 255;
		imageFloat32[i + pixelCount * 2] = b / 255;
	}

	const tensor = new Tensor('float32', imageFloat32, inputShape);
	const {output0, output1} = await session.net.run({ images: tensor });

	const boxes: Box[] = [];

	// Calculate scaled dimensions
	const scaledWidth = Math.floor(modelWidth * finalMaskScale);
	const scaledHeight = Math.floor(modelHeight * finalMaskScale);

	const scale = Math.min(
		modelWidth / imageWidth,
		modelHeight / imageHeight,
	);

	const numDetections = output0.dims[1]; // 300
	const valuesPerDetection = output0.dims[2]; // 38

	const maskHeight = output1.dims[2];
	const maskWidth = output1.dims[3];
	const numMaskCoeffs = output1.dims[1];

	// Pre-calculate all prototypes for the entire image
	const protosArray = output1.data as Float32Array;

	let detectionCount = 0;

	for(let idx = 0; idx < numDetections; idx++)
	{
		const offset = idx * valuesPerDetection;
		const data = output0.data.slice(offset, offset + valuesPerDetection) as Float32Array;

		const box = data.slice(0, 4);
		const score = data[4] as number;
		const label = Math.round(data[5] as number);

		if(score < yolo.scoreThreshold || label < 0)
			continue;

		if(yolo.topk > 0 && detectionCount >= yolo.topk)
			break;

		const boxOverflow = overflowBoxes([
				(box[0] as number) - 0.5 * (box[2] as number),
				(box[1] as number) - 0.5 * (box[3] as number),
				box[2] as number,
				box[3] as number,
			],
			maxSize
		);

		const [x, y, w, h] = overflowBoxes(
			[
				Math.floor(boxOverflow[0] * xRatio),
				Math.floor(boxOverflow[1] * yRatio),
				Math.floor(boxOverflow[2] * xRatio),
				Math.floor(boxOverflow[3] * yRatio),
			],
			maxSize
		);

		const x1 = box[0] * finalMaskScale;
		const y1 = box[1] * finalMaskScale;
		const x2 = box[2] * finalMaskScale;
		const y2 = box[3] * finalMaskScale;

		if(x2 <= x1 || y2 <= y1)
			continue;

		const scaledBox: [number, number, number, number] = [
			Math.max(0, Math.min(x1, scaledWidth)),
			Math.max(0, Math.min(y1, scaledHeight)),
			Math.max(0, Math.min(x2, scaledWidth)),
			Math.max(0, Math.min(y2, scaledHeight)),
		];

		const maskCoeffs = data.slice(6, 6 + numMaskCoeffs);

		// Process mask
		let maskData = processMaskPyTorchStyle(
			maskCoeffs as Float32Array,
			protosArray,
			numMaskCoeffs,
			maskHeight,
			maskWidth,
			boxOverflow,
			modelWidth,
			modelHeight,
			mask.threshold,
			finalMaskScale,
		);

		// Crop mask to box
		if(mask.cropToBox)
			maskData = cropMask(maskData, scaledBox, scaledWidth, scaledHeight, +mask.cropToBox);

		// Keep only largest connected components
		if(mask.maxComponents)
			maskData = maxComponents(maskData, scaledWidth, scaledHeight, mask.maxComponents);

		// Fill holes in the mask
		if(mask.fillHoles)
			maskData = fillHoles(maskData, scaledWidth, scaledHeight);

		if(mask.minArea)
		{
			const maskArea = countMaskArea(maskData);
			const scaledMinMaskArea = mask.minArea * finalMaskScale * finalMaskScale;

			if(maskArea < scaledMinMaskArea)
				continue;
		}

		boxes.push({
			label: yolo.labels[label],
			probability: score,
			width: scaledWidth,
			height: scaledHeight,
			box: scaledBox,
			mask: maskData,
		});

		detectionCount++;
	}

	return {
		boxes,
		width: scaledWidth,
		height: scaledHeight,
	};
}

function processMaskPyTorchStyle(
	maskCoeffs: Float32Array,
	protos: Float32Array,
	numProtos: number,
	protoHeight: number,
	protoWidth: number,
	box: number[],
	targetWidth: number,
	targetHeight: number,
	threshold: number = 0.5,
	scale: number = 1,
): Uint8Array {
	
	// Calculate final dimensions after scaling
	const finalWidth = Math.floor(targetWidth * scale);
	const finalHeight = Math.floor(targetHeight * scale);
	
	// Step 1: Matrix multiplication (maskCoeffs @ protos)
	// This generates the low-resolution mask
	const maskLowRes = new Float32Array(protoHeight * protoWidth);
	
	for(let y = 0; y < protoHeight; y++)
	{
		for(let x = 0; x < protoWidth; x++)
		{
			let sum = 0;

			for(let c = 0; c < numProtos; c++)
			{
				const protoIdx = c * protoHeight * protoWidth + y * protoWidth + x;
				sum += maskCoeffs[c] * protos[protoIdx];
			}

			maskLowRes[y * protoWidth + x] = sum;
		}
	}
	
	// Step 2: Sigmoid activation
	for(let i = 0; i < maskLowRes.length; i++)
	{
		maskLowRes[i] = 1 / (1 + Math.exp(-maskLowRes[i]));
	}
	
	// Step 3: Upsample to SCALED target size using bilinear interpolation
	const maskUpsampled = new Float32Array(finalHeight * finalWidth);
	const scaleX = protoWidth / finalWidth;
	const scaleY = protoHeight / finalHeight;
	
	for(let y = 0; y < finalHeight; y++)
	{
		for(let x = 0; x < finalWidth; x++)
		{
			const srcX = (x + 0.5) * scaleX - 0.5;
			const srcY = (y + 0.5) * scaleY - 0.5;
			
			const x0 = Math.floor(srcX);
			const y0 = Math.floor(srcY);
			const x1 = Math.min(x0 + 1, protoWidth - 1);
			const y1 = Math.min(y0 + 1, protoHeight - 1);
			
			const dx = Math.max(0, srcX - x0);
			const dy = Math.max(0, srcY - y0);
			
			const x0_clamped = Math.max(0, Math.min(x0, protoWidth - 1));
			const y0_clamped = Math.max(0, Math.min(y0, protoHeight - 1));
			const x1_clamped = Math.max(0, Math.min(x1, protoWidth - 1));
			const y1_clamped = Math.max(0, Math.min(y1, protoHeight - 1));
			
			const v00 = maskLowRes[y0_clamped * protoWidth + x0_clamped];
			const v10 = maskLowRes[y0_clamped * protoWidth + x1_clamped];
			const v01 = maskLowRes[y1_clamped * protoWidth + x0_clamped];
			const v11 = maskLowRes[y1_clamped * protoWidth + x1_clamped];
			
			const interpolated = 
				v00 * (1 - dx) * (1 - dy) +
				v10 * dx * (1 - dy) +
				v01 * (1 - dx) * dy +
				v11 * dx * dy;
			
			maskUpsampled[y * finalWidth + x] = interpolated;
		}
	}
	
	// Step 4: Crop mask to SCALED bounding box (CRITICAL: like crop_mask in Ultralytics)
	const x1 = Math.max(0, Math.floor(box[0] * scale));
	const y1 = Math.max(0, Math.floor(box[1] * scale));
	const x2 = Math.min(finalWidth, Math.ceil((box[0] + box[2]) * scale));
	const y2 = Math.min(finalHeight, Math.ceil((box[1] + box[3]) * scale));
	
	// Step 5: Apply threshold and create binary mask
	const binaryMask = new Uint8Array(finalHeight * finalWidth);
	
	for(let y = 0; y < finalHeight; y++)
	{
		for(let x = 0; x < finalWidth; x++)
		{
			const idx = y * finalWidth + x;
			const value = maskUpsampled[idx];
			
			// Only apply mask inside bounding box
			const insideBox = (x >= x1 && x < x2 && y >= y1 && y < y2);
			
			// Apply threshold
			binaryMask[idx] = (value > threshold && insideBox) ? 255 : 0;
		}
	}
	
	return binaryMask;
}

// Count non-zero pixels in mask
function countMaskArea(mask: Uint8Array): number {

	let count = 0;

	for(let i = 0; i < mask.length; i++)
	{
		if(mask[i] > 0)
			count++;
	}

	return count;
}

function overflowBoxes(box: number[], maxSize: number) {

	box[0] = box[0] >= 0 ? box[0] : 0;
	box[1] = box[1] >= 0 ? box[1] : 0;
	box[2] = box[0] + box[2] <= maxSize ? box[2] : maxSize - box[0];
	box[3] = box[1] + box[3] <= maxSize ? box[3] : maxSize - box[1];
	return box;

}

function cropMask(mask: Uint8Array, box: number[], width: number, height: number, offset: number = 0): Uint8Array {

	const croppedMask = new Uint8Array(width * height);

	const x1 = Math.max(0, Math.floor(box[0] - offset));
	const y1 = Math.max(0, Math.floor(box[1] - offset));
	const x2 = Math.min(width, Math.ceil(box[2] + offset));
	const y2 = Math.min(height, Math.ceil(box[3] + offset));

	for(let y = 0; y < height; y++)
	{
		for(let x = 0; x < width; x++)
		{
			const idx = y * width + x;
			const insideBox = (x >= x1 && x < x2 && y >= y1 && y < y2);
			croppedMask[idx] = insideBox ? mask[idx] : 0;
		}
	}

	return croppedMask;
}

function maxComponents(mask: Uint8Array, width: number, height: number, maxComponents: number): Uint8Array {

	const visited = new Uint8Array(mask.length);
	const components: {size: number; pixels: number[]}[] = [];

	for(let i = 0, len = mask.length; i < len; i++)
	{
		if(mask[i] > 0 && !visited[i])
		{
			const component = {size: 0, pixels: [] as number[]};
			const queue = [i];

			visited[i] = 1;

			while(queue.length > 0)
			{
				const idx = queue.shift()!;
				component.pixels.push(idx);
				component.size++;

				const x = idx % width;
				const y = Math.floor(idx / width);

				// Check 4-connected neighbors
				const neighbors = [
					idx - width, // top
					idx + width, // bottom
					idx - 1,     // left
					idx + 1,     // right
				];

				for(const nIdx of neighbors)
				{
					if(nIdx >= 0 && nIdx < mask.length && mask[nIdx] > 0 && !visited[nIdx] && Math.abs((nIdx % width) - x) <= 1)
					{
						visited[nIdx] = 1;
						queue.push(nIdx);
					}
				}
			}

			components.push(component);
		}
	}

	// Sort by size descending and keep only top maxComponents
	components.sort((a, b) => b.size - a.size);
	const largestComponents = components.slice(0, maxComponents);

	// Rebuild mask with only largest components
	const result = new Uint8Array(mask.length);
	for (const component of largestComponents)
	{
		for(const idx of component.pixels)
		{
			result[idx] = 255;
		}
	}

	return result;
}