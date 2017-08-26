const fs = require('fs');
const slackicons = require('../src/slackicons');

const options = {
    seed: 'slackicons', // Optional, specifies start seed for RNG
    size: 1000 // Optional, specifies output image width and height in pixels (default: 1000)
};

slackicons.generate(options).then((buffer) => {
    // Buffer MIME type is image/png
    fs.writeFileSync(__dirname + '/output.png', buffer);
}).catch((err) => {
    console.error(`Error: ${err}`);
});
