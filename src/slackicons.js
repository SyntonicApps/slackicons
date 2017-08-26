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
 * @param  {integer}  [size=DEFAULT_IMAGE_SIZE]     Output image width and height
 * @param  {string}    seed                         Random number generator seed to use
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

    const lowerLimit = 3, upperLimit = 4; // Arbitrary values for determining square sizes
    const randomNum = Math.floor(rng() * (upperLimit - lowerLimit + 1)) + lowerLimit;
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

    // Draw image by pixels
    let x = 0, y = 0;
    let blockRow = 0, blockCol = 0;
    while (x < imageSize && y < imageSize) { // Go until we are passed the image dimensions
        let color = getBlockColor(colorArrs, blockRow, blockCol); // Get current block color based on row / col

        // Draw pixels in the current block
        for (let blockX = 0; blockX < blockSize; blockX++) {
            for (let blockY = 0; blockY < blockSize; blockY++) {
                if (x + blockX >= imageSize || y + blockY >= imageSize) continue;

                for (let channel = 0; channel < CHANNELS; channel++) {
                    imageArr.set(x + blockX, y + blockY, channel, color[channel]);
                }
            }
        }

        // Increase the current column
        x += blockSize;
        blockCol++;

        // If we go passed the image width, drop to new row
        if (x >= imageSize) {
            // Reset current column and imcrease current row
            x = 0;
            blockCol = 0;

            y += blockSize;
            blockRow++;
        }
    }

    // Write image to buffer to read in with jimp
    const imageBuffer = await streamToBuffer(savePixels(imageArr, 'png'));

    const image = await jimpRead(imageBuffer);

    // Rotate image random number of degrees
    const degrees = Math.floor(rng() * 360);
    image.rotate(degrees, false);

    const CROP_CONST = 0.146892655; // TODO: is this even right?
    let cropPos = imageSize * CROP_CONST;
    image.crop(cropPos, cropPos, size, size);

    const imageGetBuffer = Promise.promisify(image.getBuffer, { context: image });
    return await imageGetBuffer(jimp.MIME_PNG);
};

/**
 * Extracts R G and B values from an array of Strings of the format rgb(255, 255, 255)
 * @param  {Array.string} colors        Input RGB formatted color strings
 * @return {Array.Array.integer}        Arrays containing RGB value arrays
 */
function extractRGBs(colors) {
    let colorArrs = [];

    for (let color of colors) {
        let colorStripped = color.substring(4, color.length - 1); // Remove rgb( and )
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
 * @param  {Array.Array.integer} colors        Input colors (length 3)
 * @param  {integer}             blockRow      Current block row
 * @param  {integer}             blockCol      Current block column
 * @return {Array.integer}                     Correct color for this block
 */
function getBlockColor(colors, blockRow, blockCol) {
    if (blockCol % 2 === 0 && blockRow % 2 === 0) return colors[0];
    if (blockCol % 2 !== 0 && blockRow % 2 === 0) return colors[1];
    if (blockCol % 2 === 0 && blockRow % 2 !== 0) return colors[2];
    if (blockCol % 2 !== 0 && blockRow % 2 !== 0) { // Middle, average two side colors
        return [
            Math.floor((colors[1][0] + colors[2][0]) / 2),
            Math.floor((colors[1][1] + colors[2][1]) / 2),
            Math.floor((colors[1][2] + colors[2][2]) / 2)
        ];
    }
}

exports.extractRGBs = extractRGBs;
exports.getBlockColor = getBlockColor;
