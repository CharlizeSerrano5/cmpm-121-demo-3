// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

import { Board } from "./board.ts";

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const playerLocation = OAKES_CLASSROOM;
// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const VISIBILITY_RADIUS = 8; //previously neighborhood_size
const CACHE_SPAWN_PROBABILITY = 0.1;
interface Cell {
  i: number;
  j: number;
}

interface Cache {
  coins: Coin[];
}

interface Coin {
  cell: Cell;
  serial: number;
  // serial is the unique identity of each coin
}

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

class Coin implements Coin {
  cell: Cell;
  serial: number;
  constructor(cell: Cell, serial: number) {
    this.cell = cell;
    this.serial = serial;
  }
  representIdentity() {
    return `${this.cell.i}: ${this.cell.j}#${this.serial}`;
  }

  changeLocation(cell: Cell) {
    this.cell = cell;
  }
}

// class Geocache implements Momento<string> {
//   cell: Cell;
//   numCoins: number;
//   constructor(cell: Cell, numCoins: number) {
//     this.cell = cell;
//     this.numCoins = numCoins;
//   }
//   toMomento() {
//     return this.numCoins.toString();
//   }

//   fromMomento(momento: string) {
//     this.numCoins = parseInt(momento);
//   }
// }

// const geocacheA = new Geocache();
// geocacheA.numCoins = 100;
// const momento = geocacheA.toMomento();
// const geocacheB = new Geocache();
// geocacheB.fromMomento(momento);
// console.assert(geocacheA.numCoins == geocacheB.numCoins);

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    // NOTE: map URL can be changed to nicer looking maps
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
let playerMarker: leaflet.Marker<leaflet.LatLng>;
addMarker(playerLocation);

function addMarker(location: leaflet.LatLng) {
  if (playerMarker) {
    playerMarker.remove();
  }
  playerMarker = leaflet.marker(location);
  playerMarker.bindTooltip("You are here.");
  playerMarker.addTo(map);
}

// Create Board
const board = new Board(TILE_DEGREES, VISIBILITY_RADIUS);

// Select control panel
const controlPanel = document.querySelector<HTMLDivElement>("#controlPanel")!; // element `statusPanel` is defined in index.html
const locationUpdated = new CustomEvent("location-updated");

controlPanel
  .querySelector<HTMLButtonElement>("#north")!
  .addEventListener("click", () => {
    playerLocation.lat += 1 * TILE_DEGREES;
    controlPanel.dispatchEvent(locationUpdated);
  });
controlPanel
  .querySelector<HTMLButtonElement>("#south")!
  .addEventListener("click", () => {
    playerLocation.lat -= 1 * TILE_DEGREES;
    controlPanel.dispatchEvent(locationUpdated);
  });
controlPanel
  .querySelector<HTMLButtonElement>("#west")!
  .addEventListener("click", () => {
    playerLocation.lng -= 1 * TILE_DEGREES;
    controlPanel.dispatchEvent(locationUpdated);
  });
controlPanel
  .querySelector<HTMLButtonElement>("#east")!
  .addEventListener("click", () => {
    playerLocation.lng += 1 * TILE_DEGREES;
    controlPanel.dispatchEvent(locationUpdated);
  });
controlPanel.addEventListener("location-updated", () => {
  addMarker(playerLocation);
  generateCaches();
});

// Select status panel for playerInventory
const playerCoins: Array<Coin> = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

// Events to perhaps dispatch and handle: cache-updated, player-moved, player-inventory-changed.
const cacheUpdated = new CustomEvent("cache-updated");
// const playerMoved = new CustomEvent("player-moved");
const inventoryChange = new CustomEvent("player-inventory-changed");

statusPanel.addEventListener("player-inventory-changed", () => {
  // when called change the status panel
  statusPanel.innerHTML = `${playerCoins.length} points accumulated`;
  console.log("player inventory: ", playerCoins);
});

const selectedCaches: Cache[] = [];
// const visitedCells: Array<Cell> = [];

function spawnCollectLocation(cell: Cell) {
  // when someone tries to spawn a cell we check if that cell exists
  const bounds = board.getCellBounds(cell);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  // handle interactions with the cache
  rect.bindPopup(() => {
    const coinAmount: number = Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * 100,
    );
    const cache = newCache(cell, coinAmount!);
    selectedCaches.push(cache);
    console.log("cache: ", cache);
    // Popup
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
        <div>There is a cache here at "${roundNumber(cell.i)},${
      roundNumber(cell.j)
    }". It has value <span id="value">${cache.coins.length}</span>.</div>
        <button id="collect">collect</button> <button id="deposit">deposit</button>`;
    popupDiv.addEventListener("cache-updated", () => {
      selectedCaches.pop();
      selectedCaches.push(cache);
      popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache.coins
        .length.toString();
    });
    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        // remove a coin from cache
        const cacheCoin = cache.coins.pop();
        popupDiv.dispatchEvent(cacheUpdated);
        if (cacheCoin) {
          collect(cacheCoin, cell);
        }
      });
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        const playerCoin = playerCoins.pop();
        if (playerCoin) {
          const coin = deposit(playerCoin, cell);
          cache.coins.push(coin);
          popupDiv.dispatchEvent(cacheUpdated);
        }
      });
    return popupDiv;
  });
}

board.getCellsNearPoint(playerLocation);
board.getMap();
function newCache(cell: Cell, coinAmount: number) {
  const cache: Cache = { coins: [] };
  for (let i = 0; i < coinAmount; i++) {
    const newCoin = new Coin(cell, i);
    // const newCoin: Coin = { cell: cell, serial: i };
    cache.coins.push(newCoin);
  }
  return cache;
}

function collect(coin: Coin, cell: Cell) {
  coin.cell = cell;
  playerCoins.push(coin);
  statusPanel.dispatchEvent(inventoryChange);
}

function deposit(coin: Coin, cell: Cell) {
  coin.cell = cell;
  statusPanel.dispatchEvent(inventoryChange);
  return coin;
}

// Look around the player's neighborhood for caches to spawn
// TODO: refactor

function generateCaches() {
  // TODO: will now need to move the viewing radius to ensure
  // we have no dupes
  const viewMap = board.getCellsNearPoint(playerLocation);
  console.log("viewmap: ", viewMap);
  for (let i = -VISIBILITY_RADIUS; i < VISIBILITY_RADIUS; i++) {
    for (let j = -VISIBILITY_RADIUS; j < VISIBILITY_RADIUS; j++) {
      const lat = playerLocation.lat + (i * TILE_DEGREES);
      const lng = playerLocation.lng + (j * TILE_DEGREES);
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        const newCell: Cell = { i: lat, j: lng };
        const found = viewMap.find((cell) =>
          roundNumber(cell.i) === roundNumber(lat) &&
          roundNumber(cell.j) === roundNumber(lng)
        );
        if (found) {
          spawnCollectLocation(newCell);
        }
      }
    }
  }
  for (const cell of viewMap) {
    spawnCollectLocation(cell);
  }
}

generateCaches();

function roundNumber(number: number) {
  // https://www.geeksforgeeks.org/how-
  // to-parse-float-with-two-decimal-places-in-javascript/
  return parseFloat(number.toFixed(4));
}

// NOTE: in personal code might want to clear out all old caches
// and then respawn all the ones around where the player is
// -- tell all caches they are about to be destroyed so they can save themselves
// then figure out where the player is now
// to figure out where the caches should be near
// and then rehydrate or bring back to life the caches nearby
// with any save notes you have on them
// could be an event listener like in D2
