module.exports = {
    "env": {
        "es6": true,
        "node": true,
        "mocha": true
    },
    "parser": "babel-eslint",
    "extends": "google",
    "rules": {
        "comma-dangle": ["error", "never"],
        "indent": ["error", 4],
        "linebreak-style": ["error", "unix"],
        "max-len": ["error", 120],
        "no-undef": "error",
        "no-use-before-define": "off",
        "object-curly-spacing": ["error", "always"],
        "one-var": "off"
    }
};
