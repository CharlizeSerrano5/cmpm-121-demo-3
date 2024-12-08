// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import roundNumber from "./roundNumber.ts";
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
const playerLocation: leaflet.LatLng = leaflet.latLng(
  roundNumber(OAKES_CLASSROOM.lat),
  roundNumber(OAKES_CLASSROOM.lng),
);
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

// const geocacheA = new Geocache({x: 0, y: 0}, 31);
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

function getCoinValues(coin: Coin) {
  if (coin) {
    return `${roundNumber(coin.cell.i)}: ${roundNumber(coin.cell.j)}` +
      ` #${coin.serial}`;
  } else {
    return `No more coins left.`;
  }
}

const savedRects: Array<leaflet.Rectangle> = [];

function spawnCollectLocation(cell: Cell) {
  // when someone tries to spawn a cell we check if that cell exists
  // if (cell.)
  const bounds = board.getCellBounds(cell);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  savedRects.push(rect);
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
        <button id="collect">collect</button> <button id="deposit">deposit</button><div>`;
    const coinDiv = document.createElement("div");
    coinDiv.innerHTML = `<div> The latest coin here is: </div>
         <span id="coin">${
      getCoinValues(cache.coins[cache.coins.length - 1])
    }</span>`;
    popupDiv.appendChild(coinDiv);
    popupDiv.addEventListener("cache-updated", () => {
      selectedCaches.pop();
      selectedCaches.push(cache);
      popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache.coins
        .length.toString();
      coinDiv.querySelector<HTMLSpanElement>("#coin")!.innerHTML =
        getCoinValues(cache.coins[cache.coins.length - 1]);
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
          const coin = deposit(playerCoin, cell, cache);
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

function deposit(coin: Coin, cell: Cell, cache: Cache) {
  coin.cell = cell;
  coin.serial = cache.coins.length;
  statusPanel.dispatchEvent(inventoryChange);
  return coin;
}

// Look around the player's neighborhood for caches to spawn
// TODO: refactor
const spawnedLocations: Cell[] = [];

function generateCaches() {
  // TODO: will now need to move the viewing radius to ensure
  // we have no dupes
  const viewMap = board.getCellsNearPoint(playerLocation);
  console.log("viewmap: ", viewMap);
  // search 8 tiles in vicinity from player location
  //
  // viewMap.forEach(cell=> {
  //   // console.log('typeof cell', cell.j);
  //   const bounds = board.getCellBounds(cell);
  //   const rect = leaflet.rectangle(bounds);
  //   // console.log('typeof cell', rect.addTo);
  //   rect.addTo(map);
  // })
  // savedRects.forEach(rect=> {
  //   // if savedRects is not included in viewmap
  //   rect.removeFrom(map);
  // })
  // spawnedLocations.forEach((cell) => {
  //   const exists = viewMap.some((viewCell) =>
  //     cell.i == viewCell.i && cell.j == viewCell.j
  //   );
  //   console.log(cell, exists)
  //   if (!exists) {
  //     console.log("doesnt not exist");
  //     const bounds = board.getCellBounds(cell);
  //     const rect = leaflet.rectangle(bounds);
  //     rect.removeFrom(map);
  //     rect.redraw();
  //   }
  // });
  const prev: Array<Cell> = [...spawnedLocations];
  console.log(prev);
  viewMap.forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      const exists = prev.some((viewCell) =>
        cell.i == viewCell.i && cell.j == viewCell.j
      );
      if (!exists) {
        spawnCollectLocation(cell);
        spawnedLocations.push(cell);
      } else {
        const exists = spawnedLocations.some((viewCell) =>
          cell.i == viewCell.i && cell.j == viewCell.j
        );
        console.log(cell, exists);
        // const index = prev.findIndex((viewCell) =>
        //   cell.i == viewCell.i && cell.j == viewCell.j
        // );
        // prev.splice(index, 1)
        // console.log(prev[index])
      }
      // temp.push(cell);
    }
    // else {
    //   const bounds = board.getCellBounds(cell);
    //   const rect = leaflet.rectangle(bounds);
    //   rect.remove();
    // }
  });
  // prev.forEach((cell) => {
  //   // const inNew = spawnedLocations.some((viewCell) =>
  //   //   cell.i == viewCell.i && cell.j == viewCell.j
  //   // );
  //   // console.log(cell, inNew)
  //   // if (!inNew) {
  //   //   const bounds = board.getCellBounds(cell);
  //   //   const rect = leaflet.rectangle(bounds);
  //   //   rect.removeFrom(map);
  //   //   rect.redraw();
  //   // }
  //   const bounds = board.getCellBounds(cell);
  //   const rect = leaflet.rectangle(bounds);
  //   rect.removeFrom(map);
  //   rect.redraw();
  // });
  // console.log(prev)

  // for (let i = -VISIBILITY_RADIUS; i < VISIBILITY_RADIUS; i++) {
  //   for (let j = -VISIBILITY_RADIUS; j < VISIBILITY_RADIUS; j++) {
  //     const lat = playerLocation.lat + (i * TILE_DEGREES);
  //     const lng = playerLocation.lng + (j * TILE_DEGREES);
  //     if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
  //       const newCell: Cell = { i: lat, j: lng };
  //       const found = viewMap.find((cell) =>
  //         roundNumber(cell.i) === roundNumber(lat) &&
  //         roundNumber(cell.j) === roundNumber(lng)
  //       );
  //       if (found) {
  //         spawnCollectLocation(newCell);
  //       }
  //     }
  //   }
  // }
}

// function removeCollectLocation(cell: Cell) {
// }

generateCaches();
