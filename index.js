const StarblastModding = require("starblast-modding");
const fs = require('fs').promises;
const https = require('https');
const http = require('http');

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

const ModdingEvents = StarblastModding.events;

class Game {
  constructor (node) {
    this.#node = node;
    this.modding.terminal = {
      echo: node.log.bind(node),
      error: node.error.bind(node)
    }
  }

  #node;

  modding = {
    game: this,
    context: {},
    commands: {},
    tick: function () {
      this.game?.tick?.()
    }
  }

  get custom () {
    return this.#node.custom
  }

  set custom (value) {
    this.#node.custom = value
  }

  setCustomMap (...args) {
    this.#node.setCustomMap(...args)
  }

  setOpen (...args) {
    this.#node.setOpen(...args)
  }

  get options () {
    return this.#node.options ?? null
  }

  get step () {
    return this.#node.timer.step
  }

  get link () {
    return this.#node.link ?? null
  }

  get ships () {
    return this.#node.ships.array(true).filter(ship => !ship.isSpawned() || ship.isActive())
  }

  get aliens () {
    return this.#node.aliens.array(true).filter(alien => !alien.isSpawned() || alien.isActive())
  }

  get asteroids () {
    return this.#node.asteroids.array(true).filter(asteroid => !asteroid.isSpawned() || asteroid.isActive())
  }

  get collectibles () {
    return this.#node.collectibles.array(true).filter(collectible => !collectible.isSpawned() || collectible.isActive())
  }

  findShip (id) {
    return this.ships.find(ship => ship.id === id) ?? null
  }

  findAlien (id) {
    return this.aliens.find(alien => alien.id === id) ?? null
  }

  findAsteroid (id) {
    return this.asteroids.find(asteroid => asteroid.id === id) ?? null
  }

  findCollectible (id) {
    return this.collectibles.find(collectible => collectible.id === id) ?? null
  }

  addAlien (...data) {
    this.#node.aliens.add(...data).then(a => {}).catch(e => this.#node.error(e));
    return this.aliens.slice(-1)[0]
  }

  addAsteroid (...data) {
    this.#node.asteroids.add(...data).then(a => {}).catch(e => this.#node.error(e));
    return this.asteroids.slice(-1)[0]
  }

  addCollectible (...data) {
    this.#node.collectibles.add(...data).then(a => {}).catch(e => this.#node.error(e));
    return this.collectibles.slice(-1)[0]
  }

  setUIComponent (...data) {
    this.#node.ships.setUIComponent(...data)
  }

  setObject (...data) {
    this.#node.objects.set(...data)
  }

  removeObject (...data) {
    this.#node.objects.remove(...data)
  }

  tick () {

  }

  collectibleCreated () {

  }
}

class StarblastBrowserModRunner {
  constructor(options) {
    this.#sameCodeExecution = !!options?.sameCodeExecution;
    let logErrors = this.#logErrors = !!(options?.logErrors ?? options.logExceptions ?? true);
    let logMessages = this.#logMessages = !!(options?.logMessages ?? true);
    let crashOnError = this.#crashOnError = !!(options?.crashOnException ?? options?.crashOnError);
    let node = this.#node = new StarblastModding.Client({...options, cacheEvents: true, cacheOptions: false});

    let _this = this, handle = function (spec, ...params) {
      let context = this.#game.modding?.context;
      this.#handle(context?.[spec]?.bind(context), ...params, this.#game)
    }.bind(this);

    for (let i of ["setRegion", "setECPKey"]) this[i] = node[i].bind(node);

    for (let i of ["ship", "alien", "asteroid", "collectible"]) {
      Object.defineProperty(node[i + "s"].StructureConstructor.prototype, 'game', {
        get () { return _this.#game },
        set (value) {}
      });
    }

    node.on(ModdingEvents.TICK, function (tick) {
      _this.#game?.modding?.tick?.();
      handle('tick')
    });

    // events

    node.on(ModdingEvents.ERROR, function(error) {
      if (logErrors) console.error("[In-game Error]", error)
    });

    node.on(ModdingEvents.LOG, function(...args) {
      if (logMessages) console.log("[In-game Log]", ...args)
    });

    node.on(ModdingEvents.MOD_STARTED, function (link) {
      node.log("Mod started");
      node.log(link);
      handle('event', {name: "mod_started", link})
    });

    node.on(ModdingEvents.MOD_STOPPED, function () {
      _this.#setWatchInterval(false, null);
      node.log("Mod stopped");
      handle('event', {name: "mod_stopped"})
    });

    node.on(ModdingEvents.SHIP_RESPAWNED, function(ship) {
      handle('event', {name: "ship_spawned", ship})
    });

    node.on(ModdingEvents.SHIP_SPAWNED, function(ship) {
      handle('event', {name: "ship_spawned", ship})
    });

    node.on(ModdingEvents.SHIP_DESTROYED, function(ship, killer) {
      handle('event', {name: "ship_destroyed", ship, killer})
    });

    node.on(ModdingEvents.SHIP_DISCONNECTED, function(ship) {
      handle('event', {name: "ship_disconnected", ship})
    });

    node.on(ModdingEvents.ALIEN_CREATED, function(alien) {
      handle('event', {name: "alien_created", alien})
    });

    node.on(ModdingEvents.ALIEN_DESTROYED, function(alien, killer) {
      handle('event', {name: "alien_destroyed", alien, killer})
    });

    node.on(ModdingEvents.ASTEROID_CREATED, function(asteroid) {
      handle('event', {name: "asteroid_created", asteroid})
    });
    node.on(ModdingEvents.ASTEROID_DESTROYED, function(asteroid, killer) {
      handle('event', {name: "asteroid_destroyed", asteroid, killer})
    });

    node.on(ModdingEvents.COLLECTIBLE_CREATED, function(collectible) {
      handle('event', {name: "collectible_created", collectible})
    });

    node.on(ModdingEvents.COLLECTIBLE_PICKED, function(collectible, ship) {
      handle('event', {name: "collectible_picked", collectible, ship})
    });

    node.on(ModdingEvents.STATION_DESTROYED, function(station) {
      handle('event', {name: "station_destroyed", station})
    });

    node.on(ModdingEvents.STATION_MODULE_DESTROYED, function(module) {
      handle('event', {name: "station_module_destroyed", module})
    });

    node.on(ModdingEvents.STATION_MODULE_REPAIRED, function(module) {
      handle('event', {name: "station_module_repaired", module})
    });

    node.on(ModdingEvents.UI_COMPONENT_CLICKED, function (id, ship) {
      handle('event', {name: "ui_component_clicked", id, ship})
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

  #watchChanges = false;
  #watchInterval = 5000;
  #watchIntervalID = null;
  #assignedWatch = false;

  #node;
  #game;

  #sameCodeExecution;
  #crashOnError;

  #logErrors;
  #logMessages;

  #handle (func, ...params) {
    try { func?.(...params) }
    catch (e) {
      if (this.#crashOnError) throw e;
      else this.#node.error(e)
    }
  }

  #setWatchInterval (watchChanges, interval) {
    clearInterval(this.#watchIntervalID);
    this.#assignedWatch = false;
    this.#watchChanges = !!watchChanges;
    if (this.#watchChanges) this.#watchInterval = Math.max(1, Math.floor(interval)) || 5000;
    return this
  }

  async loadCodeFromString (text) {
    this.#path = null;
    this.#URL = null;
    this.#code = text;

    this.#setWatchInterval(false, null);

    if (this.#node.started) await this.#applyChanges(true)
  }

  async loadCodeFromLocal (path, watchChanges = false, interval = 5000) {
    this.#path = path;
    this.#URL = null;
    this.#code = null;

    this.#setWatchInterval(watchChanges, interval);

    if (this.#node.started) await this.#applyChanges(true)
  }

  async loadCodeFromExternal (URL, watchChanges = false, interval = 5000) {
    this.#path = null;
    this.#URL = URL;
    this.#code = null;

    this.#setWatchInterval(watchChanges, interval);

    if (this.#node.started) await this.#applyChanges(true)
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

  async #applyChanges (forced) {
    try {
      let lastCode = this.#lastCode;
      this.#lastCode = this.#URL ? (await this.#fromExternal()) : (this.#path ? (await this.#fromLocal()) : this.#code);
      if (this.#watchChanges && (this.#URL != null || this.#path != null) && !this.#assignedWatch) {
        clearInterval(this.#watchIntervalID);
        this.#watchIntervalID = setInterval(this.#applyChanges.bind(this), this.#watchInterval);
        this.#assignedWatch = true;
      }
      if (this.#lastCode == lastCode && this.#node.started && (!forced || !this.#sameCodeExecution)) return;
      if (!this.started) this.#game = new Game(this.#node);
      let game = this.#game;
      await new AsyncFunction("game", "echo", "window", "global", this.#lastCode).call(game.modding.context, game, game.modding.terminal.echo, global, void 0)
    }
    catch (e) {
      this.#handle(function () { throw e })
    }
  }

  async start () {
    let node = this.#node;
    if (!node.started) {
      await this.#applyChanges(true);
      node.setOptions(Object.assign({}, this.#game.modding?.context?.options))
    }
    return await node.start()
  }

  async stop () {
    await this.#node.stop();
    return this
  }
}

module.exports = StarblastBrowserModRunner
