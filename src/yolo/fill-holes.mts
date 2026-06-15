export default function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {

	const size = width * height;

	const visited = new Uint8Array(size);
	const stack: number[] = [];

	const idx = (x: number, y: number) => y * width + x;

	function pushIfTransparent(x: number, y: number) {

		const i = idx(x, y);

		if(mask[i] === 0 && !visited[i])
		{
			stack.push(i);
			visited[i] = 1;
		}
	}

	for(let x = 0; x < width; x++)
	{
		pushIfTransparent(x, 0);
		pushIfTransparent(x, height - 1);
	}

	for(let y = 0; y < height; y++)
	{
		pushIfTransparent(0, y);
		pushIfTransparent(width - 1, y);
	}

	while(stack.length)
	{
		const i = stack.pop()!;
		const x = i % width;
		const y = Math.floor(i / width);

		const neighbors = [
			[x + 1, y],
			[x - 1, y],
			[x, y + 1],
			[x, y - 1],
		];

		for(const [nx, ny] of neighbors)
		{
			if(nx < 0 || ny < 0 || nx >= width || ny >= height)
				continue;

			const ni = idx(nx, ny);

			if(mask[ni] === 0 && !visited[ni])
			{
				visited[ni] = 1;
				stack.push(ni);
			}
		}
	}

	for(let i = 0; i < size; i++)
	{
		if(mask[i] === 0 && !visited[i])
		{
			mask[i] = 255;
		}
	}

	return mask;
}
