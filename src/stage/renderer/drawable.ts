import { CostumeData } from "../../messageTypes";

export class Texture {}


export class Drawable {
    protected _x: number = 0;
    protected _y: number = 0;

    protected _size: number = 100;
    protected _direction: number = 0;
    protected _visible: boolean = true;

    protected _costumeNumber = 0;

    protected costume?: WebGLTexture;
    protected costumeMap: Map<string, number> = new Map();
    costumes: CostumeData[]

    constructor(costumes: CostumeData[]) {
        this.costumes = costumes;
    }

    public switchCostumeTo(index: number) {
        // expects indexing from 0
        const image = this.costumes[index];

        if (!image) {
            return;
        }

        this._costumeNumber = index;
        this.costume = image.texture;
        // this.costume.src = image.fsPath;
    }

    public setRotation(rotation: number) {
        
    }

    public updatePosition() {

    }

    public setSize(size: number) {

    }
}