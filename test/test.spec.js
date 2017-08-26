const assert = require('chai').assert;
const fileCompare = require('file-compare');
const fs = require('fs');

const slackicons = require('../src/index');

describe('slackicons test suite', () => {
    it('should generate an icon equivalent to comparison.png', (done) => {
        const options = {
            seed: 'slackicons',
            size: 1000
        };

        slackicons.generate(options).then((buffer) => {
            fs.writeFileSync(__dirname + '/output.png', buffer);

            fileCompare.compare(__dirname + '/comparison.png', __dirname + '/output.png', (copied, err) => {
                assert.equal(copied, true);
                done();
            });
        }).catch((err) => {
            done(err);
        });
    });

    it('should generate an icon without options', (done) => {
        slackicons.generate().then((buffer) => {
            assert.isNotNull(buffer);
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('should extract rgb integer values from rgb() string', (done) => {
        const colors = slackicons.extractRGBs([
            'rgb(1, 2, 3)'
        ]);

        assert.deepEqual(colors, [[1, 2, 3]]);

        done();
    });

    it('should choose correct color based on block number', (done) => {
        const colors = slackicons.extractRGBs([
            'rgb(0, 0, 0)',
            'rgb(100, 100, 100)',
            'rgb(200, 200, 200)'
        ]);

        const centerColor = [150, 150, 150];

        assert.deepEqual(colors[0], slackicons.getBlockColor(colors, 0, 0));
        assert.deepEqual(colors[1], slackicons.getBlockColor(colors, 0, 1));
        assert.deepEqual(colors[0], slackicons.getBlockColor(colors, 0, 2));
        assert.deepEqual(colors[2], slackicons.getBlockColor(colors, 1, 0));
        assert.deepEqual(centerColor, slackicons.getBlockColor(colors, 1, 1));
        assert.deepEqual(colors[2], slackicons.getBlockColor(colors, 1, 2));
        assert.deepEqual(colors[0], slackicons.getBlockColor(colors, 2, 0));
        assert.deepEqual(colors[1], slackicons.getBlockColor(colors, 2, 1));
        assert.deepEqual(colors[0], slackicons.getBlockColor(colors, 2, 2));

        done();
    });
});
