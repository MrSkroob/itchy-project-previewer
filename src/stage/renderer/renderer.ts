import { CostumeData } from "../messageTypes";
import { BaseInstance } from "../vm/objects";
import { SpriteRenderer, getTexture } from "./rendererUtils";

// export class Texture {

// }


export class Drawable {
    private _x: number = 0;
    private _y: number = 0;

    private _layer: number = 0;
    private _size: number = 100;
    private _rotation: number = 0;
    private _visible: boolean = true;

    private _costumeNumber = 0;

    protected costume?: CostumeData;
    protected costumeMap: Map<string, number> = new Map();

    protected _rotationStyle: string = "all around";

    protected gl;

    public costumes: CostumeData[];

    
    public getCostumeNumber() {
        return this._costumeNumber;
    }

    public getX() {
        return this._x;
    }

    public getY() {
        return this._y;
    }
    
    public getSize() {
        return this._size;
    }

    public getRotation() {
        return this._rotation;
    }

    public getRotationStyle() {
        return this._rotationStyle;
    }

    public getVisible() {
        return this._visible;
    }

    constructor(gl: WebGL2RenderingContext, costumes: CostumeData[]) {
        this.gl = gl;
        this.costumes = costumes;
    }

    public getCostume(index?: number) {
        if (!index) {
            return this.costume;
        }

        if (index < 0 || index >= this.costumes.length) {
            return;
        }
        return this.costumes[index];
    }

    public switchCostumeTo(index: number) {
        // expects indexing from 0
        const costume = this.costumes[index];

        if (!costume) {
            return;
        }

        this._costumeNumber = index;
        this.costume = costume;
    }


    public setVisible(visible: boolean) {
        this._visible = visible;
    }


    public setRotation(rotation: number) {
        rotation = rotation % 360

        this._rotation = rotation;
    }

    public setX(x: number) {
        this._x = x;
    }

    public setY(y: number) {
        this._y = y;
    }

    public setSize(size: number) {
        this._size = size;
    }

    public setLayer(value: number) {
        this._layer = value;
    }

    public getLayer() {
        return this._layer;
    }
}


export class Renderer {
    private drawables: Map<string, Drawable> = new Map();
    private gl: WebGL2RenderingContext;
    private renderer: SpriteRenderer;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2");

        if (!gl) {
            throw new Error("neither webgl2 nor webgl technologies are supported.")
        }

        this.gl = gl;
        this.renderer = new SpriteRenderer(gl);
    }

    public render(renderOrder: BaseInstance[]) {
        this.renderer.clear()

        for (let index = 0; index < renderOrder.length; index++) {
            const element = renderOrder[index];
            const instance = this.drawables.get(element.name);
            if (!instance) {
                continue;
            }
            this.drawDrawable(instance);
        }
    }

    private drawDrawable(drawable: Drawable) {
        const costume = drawable.getCostume();
        if (!costume) {
            throw new Error("This guy has no costume!")
            // return;
        }

        const image = costume.texture;

        if (!image) {
            return;
        }

        let rotation = drawable.getRotation();
        let shouldFlip = false;

        switch (drawable.getRotationStyle()) {
            case "all around":
                break;
            case "left-right":
                shouldFlip = rotation > 180;
                rotation = 0;
                break;
            case "don't rotate":
                rotation = 0;
                break;
            default:
                break;
        }

        this.renderer.drawImage(
            image, 
            drawable.getX(), 
            drawable.getY(), 
            drawable.getSize() / 100, 
            rotation,
            shouldFlip
        );
    }

    public async addDrawable(id: string, drawable: Drawable) {
        for (const costume of drawable.costumes) {
            if (!costume.texture) {
                costume.texture = await getTexture(this.gl, costume.fsPath, costume.extension);
            }
        }

        this.drawables.set(id, drawable);
    }

    public removeDrawable(id: string) {
        const drawable = this.drawables.get(id);
        
        for (const costume of drawable!.costumes) {
            if (!costume.texture) { continue; }
            this.gl.deleteTexture(costume.texture.texture);

            if (!costume.texture.svgLevels) { continue; }
            costume.texture.svgLevels.forEach(element => {
                this.gl.deleteTexture(element);
            });
        }

        this.drawables.delete(id);
    }
}