const crypto = require('crypto');
const jimp = require('jimp');
const Promise = require('bluebird');
const randomColor = require('randomcolor');
const savePixels = require('save-pixels');
const seedrandom = require('seedrandom');
const StreamToBuffer = require('stream-to-buffer');
const zeros = require('zeros');

// Promisify functions
const jimpRead = Promise.promisify(jimp.read);
const randomBytes = Promise.promisify(crypto.randomBytes);
const streamToBuffer = Promise.promisify(StreamToBuffer);

const DEFAULT_IMAGE_SIZE = 1000;
const DEFAULT_SEED_LEN = 16;
const GRAY_COLOR = [236, 239, 240];
const CHANNELS = 3; // 3 channels in RGB

/**
 * Generates a Slack-like image
 * @param  {Integer}   [size=DEFAULT_IMAGE_SIZE]    Output image width and height
 * @param  {String}    seed                         Random number generator seed to use
 * @return {Buffer}                                 Output image buffer in png format
 */
exports.generate = async ({ size = DEFAULT_IMAGE_SIZE, seed } = {}) => {
    if (!seed) { // Generate random seed if one is not provided
        const buf = await randomBytes(DEFAULT_SEED_LEN);
        seed = buf.toString('hex');
    }

    const imageSize = Math.ceil(size * Math.sqrt(2)); // Big enough to take user sized image from rotated image
    const imageArr = zeros([imageSize, imageSize, CHANNELS]);

    const rng = seedrandom(seed);

    const lowerLimit = 2.5, upperLimit = 4; // Arbitrary values for determining square sizes
    const randomNum = (rng() * (upperLimit - lowerLimit) + lowerLimit).toFixed(2);
    const blockSize = Math.floor(imageSize / randomNum); // Size of one square on image

    // Generate random colors
    const colors = [
        randomColor({
            format: 'rgb',
            luminosity: 'bright',
            seed: rng().toString()
        }),
        randomColor({
            format: 'rgb',
            luminosity: 'bright',
            seed: rng().toString()
        })
    ];

    const colorArrs = [GRAY_COLOR].concat(extractRGBs(colors));
    const middleColorSeed = rng().toString();

    // Draw image by pixels
    let x = 0, y = 0;
    let blockRow = 0, blockCol = 0;
    while (x < imageSize && y < imageSize) { // Go until we are passed the image dimensions
        // Get current block color based on row / col
        const color = getBlockColor(colorArrs, blockRow, blockCol, middleColorSeed);
        // Draw pixels in the current block
        for (let blockX = 0; blockX < blockSize; blockX++) {
            for (let blockY = 0; blockY < blockSize; blockY++) {
                if (x + blockX >= imageSize || y + blockY >= imageSize) continue;

                for (let channel = 0; channel < CHANNELS; channel++) {
                    imageArr.set(x + blockX, y + blockY, channel, color[channel]);
                }
            }
        }

        // Apply AA to right edge of current block
        let edgeX = x + blockSize - 1;
        for (let edgeY = 0; edgeY < blockSize; edgeY++) {
            if (edgeX >= imageSize || y + edgeY >= imageSize) continue;

            const neighborColor = getBlockColor(colorArrs, blockRow, blockCol + 1, middleColorSeed);
            const aaColor = averageColors(color, neighborColor);

            for (let channel = 0; channel < CHANNELS; channel++) {
                imageArr.set(edgeX, y + edgeY, channel, aaColor[channel]);
            }
        }

        // Apply AA to bottom edge of current block
        let edgeY = y + blockSize - 1;
        for (let edgeX = 0; edgeX < blockSize; edgeX++) {
            if (edgeY >= imageSize || x + edgeX >= imageSize) continue;

            const neighborColor = getBlockColor(colorArrs, blockRow + 1, blockCol, middleColorSeed);
            const aaColor = averageColors(color, neighborColor);

            for (let channel = 0; channel < CHANNELS; channel++) {
                imageArr.set(x + edgeX, edgeY, channel, aaColor[channel]);
            }
        }

        // Increase the current column
        x += blockSize;
        blockCol++;

        // If we go past the image width, drop to new row
        if (x >= imageSize) {
            // Reset current column and increase current row
            x = 0;
            blockCol = 0;

            y += blockSize;
            blockRow++;
        }
    }

    // Write image to buffer to read in with jimp
    const imageBuffer = await streamToBuffer(savePixels(imageArr, 'png'));

    const image = await jimpRead(imageBuffer);

    // Rotate image random number of degrees (0 - 360, increments of 5)
    const degrees = 360 - (5 * Math.floor(rng() * 73));
    image.rotate(degrees, false);

    const CROP_CONST = 0.146892655; // TODO: is this even right?
    let cropPos = imageSize * CROP_CONST;
    image.crop(cropPos, cropPos, size, size);

    const imageGetBuffer = Promise.promisify(image.getBuffer, { context: image });
    return await imageGetBuffer(jimp.MIME_PNG);
};

/**
 * Extracts R G and B values from an array of Strings of the format rgb(x, y, z)
 * @param  {Array.String} colors        Input RGB formatted color strings
 * @return {Array.Array.Integer}        Arrays containing RGB value arrays
 */
function extractRGBs(colors) {
    let colorArrs = [];

    for (let color of colors) {
        let colorStripped = color.substring(4, color.length - 1); // Remove "rgb(" and ")"
        let colorArr = colorStripped.split(', '); // Split into array
        for (let i = 0; i < colorArr.length; i++) { // Convert into Integers
            colorArr[i] = +colorArr[i];
        }

        colorArrs.push(colorArr);
    }

    return colorArrs;
}

/**
 * Gets correct color for Slack plaid pattern based on current block number
 * @param  {Array.Array.Integer} colors        Input colors (length 3)
 * @param  {Integer}             blockRow      Current block row
 * @param  {Integer}             blockCol      Current block column
 * @param  {String}              seed          String seed to generate same random middle color
 * @return {Array.Integer}                     Correct color for this block
 */
function getBlockColor(colors, blockRow, blockCol, seed = 'seed') {
    if (blockCol % 2 === 0 && blockRow % 2 === 0) return colors[0];
    if (blockCol % 2 !== 0 && blockRow % 2 === 0) return colors[1];
    if (blockCol % 2 === 0 && blockRow % 2 !== 0) return colors[2];

    // Middle, average two side colors
    if (blockCol % 2 !== 0 && blockRow % 2 !== 0) {
        const middleColor = averageColors(colors[1], colors[2]);
        const middleHex = rgbToHex(middleColor[0], middleColor[1], middleColor[2]);
        const middleRandomColor = randomColor({
            format: 'rgb',
            luminosity: 'dark',
            hue: middleHex,
            seed
        });

        return extractRGBs([middleRandomColor])[0];
    }
}

/**
 * Averages two given colors
 * @param  {Array.Integer} colorA Input color A (length 3)
 * @param  {Array.Integer} colorB Input color B (length 3)
 * @return {Array.Integer}        Output mixed color (A + B) / 2
 */
function averageColors(colorA, colorB) {
    return [
        Math.floor((colorA[0] + colorB[0]) / 2),
        Math.floor((colorA[1] + colorB[1]) / 2),
        Math.floor((colorA[2] + colorB[2]) / 2)
    ];
}

/**
 * Converts RGB component values into a Hex color string
 * @param  {Integer} r red component value
 * @param  {Integer} g green component value
 * @param  {Integer} b blue component value
 * @return {String}    Output color of format #FFFFFF
 */
function rgbToHex(r, g, b) {
    return '#' + rgbValToHex(r) + rgbValToHex(g) + rgbValToHex(b);
}

/**
 * Converts a single RGB component value into its corresponding Hex string
 * @param  {Integer} val Input RGB component value
 * @return {String}      Component Hex string
 */
function rgbValToHex(val) {
    const hex = val.toString(16).toUpperCase();
    return hex.length == 1 ? '0' + hex : hex;
}

if (process.env.NODE_ENV === 'test') {
    exports.extractRGBs = extractRGBs;
    exports.getBlockColor = getBlockColor;
    exports.rgbToHex = rgbToHex;
    exports.rgbValToHex = rgbValToHex;
}
