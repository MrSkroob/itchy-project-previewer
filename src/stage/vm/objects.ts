import { CostumeData, ObjectState, SpriteData } from "../../messageTypes";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../common/constants";
import { Drawable } from "../renderer/drawable";
// import * as maths from "../common/mathsUtils";


const BACKDROP_Z_INDEX = 0;


export interface RuntimeWorkspace {
    stageHTML: HTMLElement;
    sprites: Map<string, BaseInstance>;
}


export interface Workspace {
    /**
     * name
     */
    stageHTML: HTMLElement;
    sprites: Map<string, BaseInstance>;
    targetViewers(target: BaseInstance): void;
    bringToFront(target: BaseSprite): void;
}


export class BaseInstance extends Drawable {
    // Scratch coordinates
    public variables: Map<String, unknown | unknown[]> = new Map();
    public isClone?: boolean;
    // protected _costumeNumber = 0;

    protected _name: string;

    // costumes: CostumeData[];
    // protected costume: HTMLImageElement; // the actual image element that gets updated
    // protected costumeMap: Map<string, number>; // the map which maps from names to indexes, used in this.costumes[]

    protected sprite: HTMLDivElement;
    protected stageHTML: HTMLElement;

    public getLayer() {
        return BACKDROP_Z_INDEX;
    }

    public get name() {
        return this._name;
    }

    public getCostumeMap() {
        return this.costumeMap;
    }

    public get costumeNumber() {
        return this._costumeNumber;
    }

    public set costumeNumber(value: number) {
        // costume switcher updates _costumeNumber internally
        this.switchCostumeTo(value);
    }

    public get costumeName() {
        return this.getCostume(this._costumeNumber)!.name;
    }

    public set costumeName(value: string) {
        const costumeIndex = this.costumeMap.get(value);
        if (costumeIndex === undefined) {
            return;
        }

        this.switchCostumeTo(costumeIndex!);
    }

    constructor(data: SpriteData, stageHTML: HTMLElement) {
        super(data.costumes);
        this._name = data.name;
        this.costumes = data.costumes;
        this.stageHTML = stageHTML;
        this.isClone = data.isClone;

        this.sprite = document.createElement("div");
        this.sprite.dataset.spriteId = data.name;

        this.costumeMap = new Map();

        let index = 0;
        for (const costume of data.costumes) {
            this.costumeMap.set(costume.name, index);
            index += 1;
        }

        const image = document.createElement("img");
        image.draggable = false;
        this.costume = image;
        this.sprite.replaceChildren(image);

        // Actually add the sprite to the HTML stage
        this.stageHTML.appendChild(this.sprite);

        if (this.costumes.length > 0) {
            this.switchCostumeTo(0);
        }
    }

    public getSprite() {
        return this.sprite;
    }

    private getCostume(index: number) {
        if (index < 0 || index >= this.costumes.length) {
            return;
        }
        return this.costumes[index];
    }

    // public switchCostumeTo(index: number) {
    //     // expects indexing from 0
    //     const image = this.costumes[index];

    //     if (!image) {
    //         return;
    //     }

    //     this._costumeNumber = index;
    //     this.costume.src = image.fsPath;
    // }

    public remove() {
        this.sprite.remove();
    }
}


export class BaseBackdrop extends BaseInstance {
    constructor(data: SpriteData, stageHTML: HTMLElement) {
        super(data, stageHTML);
        if (data.data) {
            this.fromJSON(data.data);
        }
        this.sprite.className = "backdrop";
        this.sprite.style.zIndex = String(BACKDROP_Z_INDEX);
    }

    public setLayer() {
        return;
    }

    public toJSON(): ObjectState {
        return {
            name: this.name,
            visible: true,
            size: 100,
            x: 0,
            y: 0,
            layer: 0,
            costumeNumber: this.costumeNumber,
            rotation: 90,
            rotationStyle: "all around"
        };
    }

    public fromJSON(state: ObjectState) {
        this._name = state.name;
        this.costumeNumber = state.costumeNumber;
    }
}


export class BaseSprite extends BaseInstance {
    protected _size = 100;

    protected _layer = 0;
    protected _rotation = 0;
    protected _rotationStyle = "all around";

    protected _x = 0;
    protected _y = 0;

    protected _visible = true;

    public getLayer() {
        return this._layer;
    }

    public setLayer(value: number) {
        // careful: this doesn't update the sprite's layer during runtime.
        this._layer = value;
    }

    public get visible() {
        return this._visible;
    }

    public set visible(value: boolean) {
        this._visible = value;
        this.setVisible(value);
    }

    public get size() {
        return this._size * 100;
    }

    public set size(value: number) {
        this._size = value / 100;
        this.setSize(this._size);
    }

    public get x() {
        return Math.round(this._x);
    }

    public set x(value: number) {
        this._x = value;
        this.updatePosition();
    }

    public get y() {
        return Math.round(this._y);
    }

    public set y(value: number) {
        this._y = value;
        this.updatePosition();
    }

    public get layer() {
        return this._layer;
    }

    public get rotation() {
        return this._rotation + 90;
    }

    public set rotation(value: number) {
        this.setRotation(value - 90);
    }

    public get rotationStyle() {
        return this._rotationStyle;
    }

    public set rotationStyle(value: string) {
        this._rotationStyle = value;
        this.setRotation(this._rotation);
    }

    constructor(data: SpriteData, stageHTML: HTMLElement) {
        super(data, stageHTML);
        this.sprite.className = "sprite";
        if (data.data) {
            this.fromJSON(data.data);
        }
        this.updatePosition();
    }

    public getSprite() {
        return this.sprite;
    }

    public setVisible(visible: boolean) {
        this._visible = visible;
        this.sprite.hidden = !visible;
    }

    // public setSize(size: number) {
    //     this._size = size;
    //     const image = this.costume;
    //     const minScale = Math.max(
    //         5 / image.naturalWidth,
    //         5 / image.naturalHeight
    //     );

    //     const scale = Math.max(size, minScale);

    //     image.style.scale = String(scale);
    // }

    private pointsLeft(direction: number) {
        direction = ((direction + 180) % 360 + 360) % 360 - 180;

        return direction < 0;
    }

    // public setRotation(degrees: number) {
    //     const image = this.costume;

    //     this._rotation = degrees % 360;

    //     switch (this._rotationStyle) {
    //         case "left-right":
    //             image.style.transform =
    //                 this.pointsLeft(this._rotation)
    //                     ? "scaleX(-1)"
    //                     : "scaleX(1)";
    //             break;
    //         case "all around":
    //             image.style.transform = `rotate(${this._rotation}deg)`;
    //             break;
    //         case "don't rotate":
    //             image.style.transform = `rotate(0deg)`;
    //             break;
    //         default:
    //             break;
    //     }
    // }

    // public updatePosition() {
    //     let x = Math.round(this._x);
    //     let y = Math.round(this._y);

    //     this.sprite.style.left =
    //     `${((x + STAGE_WIDTH / 2) / STAGE_WIDTH) * 100}%`;

    //     this.sprite.style.top =
    //         `${((STAGE_HEIGHT / 2 - y) / STAGE_HEIGHT) * 100}%`;
    // }

    // public remove() {
    //     // if (selectedSprite && selectedSprite.name === this.name) {
    //     //     selectedSprite = undefined;
    //     // }
    //     this.sprite.remove();
    // }

    public clone(): BaseSprite {
        const data = {
            name: this.name,
            costumes: this.costumes,
            data: this.toJSON(),
            isClone: true
        };
        return new BaseSprite(data, this.stageHTML);
    }

    public toJSON(): ObjectState {
        return {
            name: this.name,
            size: this.size,
            visible: this.visible,
            x: this.x,
            y: this.y,
            layer: this.layer,
            costumeNumber: this.costumeNumber,
            rotation: this.rotation,
            rotationStyle: this.rotationStyle
        };
    }

    public fromJSON(state: ObjectState) {
        this.x = state.x;
        this.y = state.y;
        this._name = state.name;
        this._layer = state.layer;
        this.rotation = state.rotation;
        this.size = state.size;
        this.rotationStyle = state.rotationStyle;
        this.costumeNumber = state.costumeNumber;
    }
}

