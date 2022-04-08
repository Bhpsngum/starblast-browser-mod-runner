# starblast-browser-mod-runner
A npm package to run mod codes from browser (featuring the [starblast-modding](https://npmjs.com/package/starblast-modding) npm itself)

## Warning
* This package doesn't support undocumented features like accessing through `game.modding`, etc.
* Since this package is dependent on the [starblast-modding](https://npmjs.com/package/starblast-modding) npm, some of its latest features (which may doesn't work in browsers) will be available

## Installation
```
npm install starblast-browser-mod-runner
```

## Using the library

### Require the library
```js
const StarblastBrowserModRunner = require("starblast-browser-mod-runner");
```

### Create a container
```js
let container = new StarblastBrowserModRunner({cacheConfiguration: true}); // options from the original starblast-modding npm
```

This container will act as your browser, which has methods described below:

| Method name | Description |
| - | - |
| setRegion(region) | set the region the mod will be run on, must be Asia, America or Europe |
| setECPKey(ECPKey) | set the ECP Key this npm will be used for sending mod creation requests |
| start | start the mod, returns a promise |
| stop | start the mod, returns a promise |
| loadCodeFromString(script) | load the mod code from a script string |
| loadCodeFromLocal(path) | load the mod code from a local file (File on your device) |
| loadCodeFromExternal(URL) | load the mod code from an external URL file |
| getNode() | returns the original game object called from the [starblast-modding](https://npmjs.com/package/starblast-modding) npm) |
| getGame() | returns the game object, which acts the same as it is in browser |

### Example
Here is an example for running SDC code pulled from Neuronality's site:

```js
const BrowserModRunner = require("starblast-browser-mod-runner");

global.container = new BrowserModRunner({cacheConfiguration: false});

container.setRegion("Asia");

container.setECPKey("12345-6789");

container.loadCodeFromExternal("https://starblast.data.neuronality.com/mods/sdc.js");

container.start();

global.game = container.getGame();

global.node = container.getNode();
```
