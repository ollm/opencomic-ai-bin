import fs from 'fs';

const files = [
	// Linux binaries
	'./linux/x64/upscayl/upscayl-bin',
	'./linux/arm64/upscayl/upscayl-bin',
	'./linux/x64/realcugan/realcugan-ncnn-vulkan',
	'./linux/arm64/realcugan/realcugan-ncnn-vulkan',
	'./linux/x64/waifu2x/waifu2x-ncnn-vulkan',
	'./linux/arm64/waifu2x/waifu2x-ncnn-vulkan',

	// Mac binaries
	'./mac/x64/upscayl/upscayl-bin.app',
	'./mac/arm64/upscayl/upscayl-bin.app',
	'./mac/x64/realcugan/realcugan-ncnn-vulkan.app',
	'./mac/arm64/realcugan/realcugan-ncnn-vulkan.app',
	'./mac/x64/waifu2x/waifu2x-ncnn-vulkan.app',
	'./mac/arm64/waifu2x/waifu2x-ncnn-vulkan.app',
];

for(const file of files)
{
	try
	{
		fs.chmodSync(file, 0o755);
		console.log(`Permissions for ${file} set to 755`);
	}
	catch(err)
	{
		console.error(`Failed to set permissions for ${file}:`, err);
	}
}