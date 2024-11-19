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
        return this.knownCells.get(key)!;
    }

    getCellForPoint(point: leaflet.LatLng): Cell {
        // pass to other function
        console.log('point: ', point);
        return this.getCanonicalCell({
            i: point.lat,
            j: point.lang
        });
    }

    getCellBounds(cell: Cell): leaflet.LatLngBounds {
    	// ...
        // TODO: check if correct
        return leaflet.latLngBounds([
            [cell.i, cell.j],
            [
              (cell.i + 1),
              (cell.j + 1),
            ],
          ]);
    }

    getCellsNearPoint(point: leaflet.LatLng): Cell[] {
        const resultCells: Cell[] = [];
        const originCell = this.getCellForPoint(point);
        // ...
        // push the cells onto the result cells
        console.log('originCell: ', originCell);
        return resultCells;
    }
}
