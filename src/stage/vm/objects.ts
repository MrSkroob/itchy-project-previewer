import { ObjectState, SpriteData } from "../messageTypes";
// import { STAGE_HEIGHT, STAGE_WIDTH } from "../common/constants";
import { getTexture } from "../renderer/rendererUtils";
import { Drawable } from "../renderer/renderer";
import { type Monitor } from "../monitors";
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
    public variables: Map<string, unknown | unknown[]> = new Map();
    public isClone?: boolean;

    protected monitors: WeakMap<String, Monitor> = new WeakMap();
    protected _name: string;

    protected sprite: HTMLDivElement;
    protected stageHTML: HTMLElement;

    public setVariable(variable: string, value: any) {
        this.variables.set(variable, value);
        this.monitors.get(String(variable))
    }

    public get name() {
        return this._name;
    }

    public getCostumeMap() {
        return this.costumeMap;
    }

    public get costumeNumber() {
        return this.getCostumeNumber();
    }

    public set costumeNumber(value: number) {
        // costume switcher updates _costumeNumber internally
        this.switchCostumeTo(value);
    }

    public get costumeName() {
        return this.getCostume(this.getCostumeNumber())!.name;
    }

    public set costumeName(value: string) {
        const costumeIndex = this.costumeMap.get(value);
        if (costumeIndex === undefined) {
            return;
        }

        this.switchCostumeTo(costumeIndex!);
    }

    constructor(gl: WebGL2RenderingContext, data: SpriteData, stageHTML: HTMLElement) {
        super(gl, data.costumes);
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

        // const image = document.createElement("img");
        // image.draggable = false;
        // this.costume = image;
        // this.sprite.replaceChildren(image);

        // Actually add the sprite to the HTML stage
        this.stageHTML.appendChild(this.sprite);

        if (this.costumes.length > 0) {
            this.switchCostumeTo(0);
        }
    }

    public getSprite() {
        return this.sprite;
    }

    public remove() {
        this.sprite.remove();
    }
}


export class BaseBackdrop extends BaseInstance {
    constructor(gl: WebGL2RenderingContext, data: SpriteData, stageHTML: HTMLElement) {
        super(gl, data, stageHTML);
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
    public get visible() {
        return super.getVisible();
    }

    public set visible(value: boolean) {
        super.setVisible(value);
    }

    public get size() {
        return super.getSize();
    }

    public set size(value: number) {
        super.setSize(value);
    }

    public get x() {
        return Math.round(super.getX());
    }

    public set x(value: number) {
        super.setX(value);
    }

    public get y() {
        return Math.round(this.getY());
    }

    public set y(value: number) {
        super.setY(value);
    }

    public get layer() {
        return this.getLayer();
    }

    public get rotation() {
        return Math.round(this.getRotation() + 90);
    }

    public set rotation(value: number) {
        super.setRotation(value - 90);
    }

    public get rotationStyle() {
        return super.getRotationStyle();
    }

    public set rotationStyle(value: string) {
        this._rotationStyle = value;
    }

    constructor(gl: WebGL2RenderingContext, data: SpriteData, stageHTML: HTMLElement) {
        super(gl, data, stageHTML);
        this.sprite.className = "sprite";
        if (data.data) {
            this.fromJSON(data.data);
        }
    }

    public getSprite() {
        return this.sprite;
    }

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
        return new BaseSprite(this.gl, data, this.stageHTML);
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
        // this.layer = state.layer;
        super.setLayer(state.layer);
        this.rotation = state.rotation;
        this.size = state.size;
        this.visible = state.visible;
        this.rotationStyle = state.rotationStyle;
        this.costumeNumber = state.costumeNumber;
    }
}


