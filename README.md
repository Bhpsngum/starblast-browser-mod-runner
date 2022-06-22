# starblast-browser-mod-runner
A npm package to run mod codes from browser (featuring the [starblast-modding](https://npmjs.com/package/starblast-modding) npm itself)

## Warning
* This package doesn't support undocumented features like accessing through `game.modding`, etc.
* Since this package is dependent on the [starblast-modding](https://npmjs.com/package/starblast-modding) npm, some of its latest features (which may doesn't work in browsers) will be available

## Installation
```
> npm i starblast-browser-mod-runner
```

## Using the library

### Require the library
```js
const StarblastBrowserModRunner = require("starblast-browser-mod-runner");
```

### Create a container
```js
let container = new BrowserModRunner(options);
```

Properties to be passed in the `options` object: (note that if both one property and its aliases exist on the object, the value of the main one will be chosen)

| Property | Alias | Default (if null/undefined or omitted)| Description |
| - | - | - | - |
| cacheECPKey | none | false | starblast-modding NPM feature |
| sameCodeExecution | none | false | loading the same code will trigger the execution or not<br>**Note:** This feature only works when you call `loadCodeFromString`, `loadCodeFromLocal` or `loadCodeFromExternal` methods, and not during the auto-update process |
| crashOnException | crashOnError | false | when tick or event function, or mod code execution fails, the mod will crash (true) or it just logs the error and continue (false) |
| logErrors | logExceptions | true | game will log any errors or not |
| logMessages | none | true | game will log any in-game logs or not |

This container will act as your browser, which has methods described below:

| Method name | Description |
| - | - |
| setRegion(region) | set the region the mod will be run on, must be Asia, America or Europe |
| setECPKey(ECPKey) | set the ECP Key this npm will be used for sending mod creation requests |
| <Async> start() | start the mod, returns a promise |
| <Async> stop() | stop the mod, returns a promise |
| <Async> loadCodeFromString(script) | load the mod code from a script string |
| <Async> loadCodeFromLocal(path, watchChanges, interval) | load the mod code from a local file (File on your device) |
| <Async> loadCodeFromExternal(URL, watchChanges, interval) | load the mod code from an external URL file |
| getNode() | returns the original game object called from the [starblast-modding](https://npmjs.com/package/starblast-modding) npm |
| getGame() | returns the game object, which acts the same as it is in browser |

**Note:**
* If there are any errors in the code, the errors will be logged (with `logErrors = true`) when you start the mod or request for new codes while the mod is still running.
* With `loadCodeFromLocal` and `loadCodeFromExternal` method, you can define changes detector by passing `watchChanges` (`true`/`false`) and `interval` (integer with value > 1) to set up watchers.

### Example
Here is an example for running SDC code pulled from Neuronality's site:

```js
const BrowserModRunner = require("starblast-browser-mod-runner");

let container = new BrowserModRunner({
  cacheECPKey: true,
  cacheOptions: true
});

container.setRegion("Asia");

container.setECPKey("12345-6789");

container.loadCodeFromExternal("https://starblast.data.neuronality.com/mods/sdc.js");

container.start();

let game = container.getGame();

let node = container.getNode();
```
