const StarblastModding = require("starblast-modding");
const fs = require('fs').promises;
const https = require('https');
const http = require('http');

class StarblastBrowserModRunner {
  constructor(options) {
    this.#node = new StarblastModding.Client(options),
    this.#game = {
      modding: {
        context: {}
      }
    }

    let game = this.#game, node = this.#node, context = game.modding.context;

    for (let i of ["setCustomMap", "setOpen"]) game[i] = function(...data) {
      node[i](...data)
    }

    for (let i of ["ship", "alien", "asteroid", "collectible", "team"]) {
      Object.defineProperty(game, i + "s", {
        get() {return node[i + "s"]?.array?.() ?? null}
      });
      game["find" + i[0].toUpperCase() + i.slice(1)] = function (...data) {
        return node[i + "s"]?.findById?.(...data) ?? null
      }
    }

    Object.defineProperty(game, 'stations', {
      get() {return node.teams?.stations?.array?.() ?? null}
    });

    game.findStation = function(...data) {
      return node.teams?.stations?.findById?.(data) ?? null
    }

    for (let i of ["step", "options", "link"]) Object.defineProperty(game, i, {
      get() {return node[i]}
    });

    for (let i of ["alien", "asteroid", "collectible"]) game["add" + i[0].toUpperCase() + i.slice(1)] = function (...data) {
      let manager = node[i + "s"];
      manager.add(...data);
      return manager.all.toArray().slice(-1)[0]
    }

    game.setUIComponent = function (...data) {
      node.ships.setUIComponent(data)
    }

    game.setObject = function (...data) {
      node.objects.set(...data)
    }

    game.removeObject = function (...data) {
      node.objects.remove(...data)
    }

    node.on('tick', function (tick) {
      context.tick?.(game)
    });

    // events

    game.echo = function (...data) {
      node.log(...data);
    }

    node.on('error', function(error) {
      console.log("In-game error: " + error.message)
    });

    node.on('log', function(...args) {
      console.log("In-game log:", ...args);
    });

    node.on('start', function (link) {
      console.log("Mod started\n" + link);
      context.event?.({name: "mod_started", link}, game)
    });

    node.on('stop', function () {
      console.log("Mod stopped");
      context.event?.({name: "mod_stopped"}, game)
    });

    node.on('shipRespawn', function(ship) {
      context.event?.({name: "ship_spawned", ship}, game)
    });

    node.on('shipSpawn', function(ship) {
      context.event?.({name: "ship_spawned", ship}, game)
    });

    node.on('shipDestroy', function(ship, killer) {
      context.event?.({name: "ship_destroyed", ship, killer}, game)
    });

    node.on('shipDisconnect', function(ship) {
      context.event?.({name: "ship_disconnected", ship}, game)
    });

    node.on('alienCreate', function(alien) {
      context.event?.({name: "alien_created", alien}, game)
    });

    node.on('alienDestroy', function(alien, killer) {
      context.event?.({name: "alien_destroyed", alien, killer}, game)
    });

    node.on('asteroidCreate', function(asteroid) {
      context.event?.({name: "asteroid_created", asteroid}, game)
    });
    node.on('asteroidDestroy', function(asteroid, killer) {
      context.event?.({name: "asteroid_destroyed", asteroid, killer}, game)
    });

    node.on('collectibleCreate', function(collectible) {
      context.event?.({name: "collectible_created", collectible}, game)
    });

    node.on('collectiblePick', function(collectible, ship) {
      context.event?.({name: "collectible_picked", collectible, ship}, game)
    });

    node.on('stationDestroy', function(station) {
      context.event?.({name: "station_destroyed", station}, game)
    });

    node.on('stationModuleDestroy', function(module) {
      context.event?.({name: "station_module_destroyed", module}, game)
    });

    node.on('stationModuleRepair', function(module) {
      context.event?.({name: "station_module_repaired", module}, game)
    });

    node.on('UIComponentClick', function (id, ship) {
      context.event?.({name: "ui_component_clicked", id, ship}, game)
    });
  }

  setRegion (...data) {
    this.#node.setRegion(...data)
  }

  setECPKey (...data) {
    this.#node.setECPKey(...data)
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

  #node;
  #game

  loadCodeFromString (text) {
    this.#path = null;
    this.#URL = null;
    this.#code = text
  }

  loadCodeFromLocal (path) {
    this.#path = path;
    this.#URL = null;
    this.#code = null
  }

  loadCodeFromExternal (URL) {
    this.#path = null;
    this.#URL = URL;
    this.#code = null
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
          reject(new Error('Request Failed.\nStatus Code: '+ statusCode))
        }

        let rawData = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', function () {
          try { resolve(rawData) }
          catch (e) { reject(e) }
        });
      }).on('error', reject)
    })
  }

  async start () {
    let code = this.#URL ? (await this.#fromExternal()) : (this.#path ? (await this.#fromLocal()) : this.#code), game = this.#game, node = this.#node;;
    if (!node.started) game.custom = {};
    Function("game", code).call(game.modding.context, game);
    node.setOptions(Object.assign({}, game.modding.context.options));
    return await node.start()
  }

  stop () {
    return this.#node.stop()
  }
}

module.exports = StarblastBrowserModRunner
