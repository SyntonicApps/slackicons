# slackicons

A simple Node.js module for generating Slack-like profile icons

![example 1](example1.png)
![example 2](example2.png)
![example 2](example3.png)

Install `npm install slackicons`

Import `const slackicons = require('slackicons')`

## Usage

The `generate` method generates an image, taking an optional random seed and image size.

```
const fs = require('fs');
const slackicons = require('slackicons');

const options = {
    seed: 'slackicons', // Optional, specifies start seed for RNG
    size: 1000 // Optional, specifies output image width and height in pixels (default: 1000)
};

slackicons.generate(options).then((buffer) => {
    // Buffer MIME type is image/png
    fs.writeFileSync('./output.png', buffer);
}).catch((err) => {
    console.error(`Error: ${err}`);
});
```

NOTE: A size of 500 or greater is recommended until some sort of anti aliasing is added.

## Building

slackicons uses Babel to build. Install the latest version of [Node.js](https://nodejs.org/en/)

`npm install`

`npm run build`

The build script transpiles all files in `/src` and outputs them in `/dist`

## Tests

Mocha tests are located in `/test`

[Chai](https://github.com/chaijs/chai) is used for assertion, and [nyc](https://github.com/istanbuljs/nyc) is used for code coverage.

`npm install`

`npm test`

## Contributing

Feel free to fork and PR! I only ask that you follow the ESLint rules set in `.eslintrc.js`.
PRs with ESLint errors will not be accepted.

Make sure to add any Mocha tests for new features!

## [Changelog](CHANGELOG)

## [License](LICENSE)
