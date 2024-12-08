import leaflet from "leaflet";
import roundNumber from "./roundNumber.ts";
interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>(); // initialize a private variable
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    const checkCell = this.knownCells.get(key);
    console.log("knowncells: ", this.knownCells);
    console.log("check: ", checkCell);
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    // pass to other function
    const newCell: Cell = { i: point.lat, j: point.lng };
    return this.getCanonicalCell(newCell);
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [cell.i, cell.j],
      [
        cell.i + this.tileWidth,
        cell.j + this.tileWidth,
      ],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    // TODO: refactor
    const originCell = this.getCellForPoint(point);
    const radius = this.tileVisibilityRadius;
    if (originCell) {
      for (let i = -radius; i < radius; i++) {
        for (let j = -radius; j < radius; j++) {
          // visit every cell in radius of the origin cell
          const newPoint = {
            lat: roundNumber(point.lat + (i * this.tileWidth)),
            lng: roundNumber(point.lng + (j * this.tileWidth)),
          };
          const check = this.getCellForPoint(newPoint);
          if (check) {
            resultCells.push(check);
          }
        }
      }
    }
    return resultCells;
  }

  getMap() {
    console.log(this.knownCells);
  }
}
