const StarblastModding = require("starblast-modding");
const fs = require('fs').promises;
const https = require('https');
const http = require('http');

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

class StarblastBrowserModRunner {
  constructor(options) {
    this.#sameCodeExecution = !!options?.sameCodeExecution
    let crashOnError = this.#crashOnError = !!options?.crashOnError;
    let node = this.#node = new StarblastModding.Client({...options, cacheEvents: true});
    this.#game = {}

    this.#assignBasic();

    let game = this.#game, handle = function (spec, ...params) {
      try { game.modding?.context?.[spec]?.(...params) }
      catch (e) {
        if (crashOnError) throw e;
        else console.error(e);
      }
    };

    Object.defineProperty(game, 'custom', {
      get () { return node.custom },
      set (value) { node.custom = value }
    })

    for (let i of ["setCustomMap", "setOpen"]) game[i] = node[i].bind(node);

    for (let i of ["setRegion", "setECPKey"]) this[i] = node[i].bind(node);

    for (let i of ["ship", "alien", "asteroid", "collectible"]) {
      Object.defineProperty(game, i + "s", {
        get () { return node[i + "s"].array(true).filter(structure => !structure.isSpawned() || structure.isActive()) },
        set (value) {}
      });
      Object.defineProperty(node[i + "s"].StructureConstructor.prototype, 'game', {
        get () { return game },
        set (value) {}
      })
      game["find" + i[0].toUpperCase() + i.slice(1)] = function(...data) {
        return node[i + "s"].findById(...data)
      }
    }

    for (let i of ["step", "options", "link"]) Object.defineProperty(game, i, {
      get() { return node[i] ?? null },
      set (value) {}
    });

    for (let i of ["alien", "asteroid", "collectible"]) game["add" + i[0].toUpperCase() + i.slice(1)] = function (...data) {
      let name = i + "s";
      node[name].add(...data).then(a => {}).catch(b => console.error("[In-game Error]", b));
      let test = this[name].slice(-1)[0];
      return test;
    }

    game.setUIComponent = node.ships.setUIComponent.bind(node.ships);

    game.setObject = function(...data) {
      node.objects.set(...data)
    }

    game.removeObject = function(...data) {
      node.objects.remove(...data)
    }

    node.on('tick', function (tick) {
      handle('tick', game)
    });

    // events

    node.on('error', function(error) {
      console.error("[In-game Error]", error)
    });

    node.on('log', function(...args) {
      console.log("[In-game Log]", ...args);
    });

    node.on('start', function (link) {
      console.log("Mod started\n" + link);
      handle('event', {name: "mod_started", link}, game)
    });

    node.on('stop', function () {
      console.log("Mod stopped");
      handle('event', {name: "mod_stopped"}, game)
    });

    node.on('shipRespawn', function(ship) {
      handle('event', {name: "ship_spawned", ship}, game)
    });

    node.on('shipSpawn', function(ship) {
      handle('event', {name: "ship_spawned", ship}, game)
    });

    node.on('shipDestroy', function(ship, killer) {
      handle('event', {name: "ship_destroyed", ship, killer}, game)
    });

    node.on('shipDisconnect', function(ship) {
      handle('event', {name: "ship_disconnected", ship}, game)
    });

    node.on('alienCreate', function(alien) {
      handle('event', {name: "alien_created", alien}, game)
    });

    node.on('alienDestroy', function(alien, killer) {
      handle('event', {name: "alien_destroyed", alien, killer}, game)
    });

    node.on('asteroidCreate', function(asteroid) {
      handle('event', {name: "asteroid_created", asteroid}, game)
    });
    node.on('asteroidDestroy', function(asteroid, killer) {
      handle('event', {name: "asteroid_destroyed", asteroid, killer}, game)
    });

    node.on('collectibleCreate', function(collectible) {
      handle('event', {name: "collectible_created", collectible}, game)
    });

    node.on('collectiblePick', function(collectible, ship) {
      handle('event', {name: "collectible_picked", collectible, ship}, game)
    });

    node.on('stationDestroy', function(station) {
      handle('event', {name: "station_destroyed", station}, game)
    });

    node.on('stationModuleDestroy', function(module) {
      handle('event', {name: "station_module_destroyed", module}, game)
    });

    node.on('stationModuleRepair', function(module) {
      handle('event', {name: "station_module_repaired", module}, game)
    });

    node.on('UIComponentClick', function (id, ship) {
      handle('event', {name: "ui_component_clicked", id, ship}, game)
    });
  }

  getNode () {
    return this.#node
  }

  getGame () {
    return this.#game
  }

  #path;
  #URL;
  #code;
  #lastCode = null;

  #node;
  #game;

  #sameCodeExecution;
  #crashOnError;

  #assignBasic () {
    let node = this.#node;
    this.#game.modding = {
      terminal: {
        echo: node.log.bind(node),
        error: node.error.bind(node)
      },
      context: {}
    }
  }

  async loadCodeFromString (text) {
    this.#path = null;
    this.#URL = null;
    this.#code = text;
    if (this.#node.started) await this.#applyChanges()
  }

  async loadCodeFromLocal (path) {
    this.#path = path;
    this.#URL = null;
    this.#code = null;
    if (this.#node.started) await this.#applyChanges()
  }

  async loadCodeFromExternal (URL) {
    this.#path = null;
    this.#URL = URL;
    this.#code = null;
    if (this.#node.started) await this.#applyChanges()
  }

  #fromLocal () {
    return fs.readFile(this.#path, 'utf-8')
  }

  #fromExternal () {
    let URL = String(this.#URL);
    return new Promise(function (resolve, reject) {
      let fetcher = URL.startsWith("https://") ? https : http;
      fetcher.get(URL, function (res) {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (Math.trunc(statusCode / 100) != 2) {
          res.resume();
          reject(new Error("Failed to fetch the file at URL '" + URL + "'. Resource status code: "+ statusCode))
        }

        let rawData = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', function () {
          resolve(rawData)
        });
      }).on('error', reject)
    })
  }

  async #applyChanges () {
    let lastCode = this.#lastCode;
    try {
      this.#lastCode = this.#URL ? (await this.#fromExternal()) : (this.#path ? (await this.#fromLocal()) : this.#code);
      let game = this.#game;
      if (this.#lastCode == lastCode && this.#node.started && !this.#sameCodeExecution) return;
      this.#assignBasic()
      new AsyncFunction("game", "echo", this.#lastCode).call(game.modding.context, game, game.modding.terminal.echo);
    }
    catch (e) {
      this.#lastCode = lastCode;
      throw e;
    }
  }

  async start () {
    let node = this.#node;
    if (!node.started) {
      await this.#applyChanges();
      node.setOptions(Object.assign({}, this.#game.modding?.context?.options))
    }
    return await node.start()
  }

  stop () {
    return this.#node.stop()
  }
}

module.exports = StarblastBrowserModRunner
