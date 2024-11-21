import leaflet from "leaflet";

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
    // ...
    if (!this.knownCells.get(key)) {
      // set new knownCells if no key is found
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
    const northEast: Cell = this.getCellBounds(originCell)._northEast;
    const southWest = this.getCellBounds(originCell)._southWest;
    const findCells: Cell[] = [];
    findCells.push(northEast);
    findCells.push(southWest);
    console.log("findCells: ", findCells);
    for (const cell of findCells) {
      const foundCell = this.getCellForPoint(cell);
      console.log("returned: ", foundCell);
      if (foundCell) {
        resultCells.push(foundCell);
      }
    }
    console.log("resultCells: ", resultCells);
    return resultCells;
  }
}
