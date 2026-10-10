import { CostumeData } from "../messageTypes";
import { SpriteRenderer, getTexture } from "./rendererUtils";

// export class Texture {

// }


export class Drawable {
    protected _x: number = 0;
    protected _y: number = 0;

    protected _layer: number = 0;
    protected _size: number = 100;
    protected _rotation: number = 0;
    protected _visible: boolean = true;

    protected _costumeNumber = 0;

    protected costume?: CostumeData;
    protected costumeMap: Map<string, number> = new Map();

    protected _rotationStyle: string = "all around";

    protected gl;

    costumes: CostumeData[];

    public get x() {
        return this._x;
    }

    public get y() {
        return this._y;
    }
    
    public get size() {
        return this._size;
    }

    public get rotation() {
        return this._rotation;
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
        this._rotation = rotation;
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

    public render() {
        this.renderer.clear()

        for (const [_, drawable] of this.drawables) {
            this.drawDrawable(drawable);
        }
    }

    private drawDrawable(drawable: Drawable) {
        const costume = drawable.getCostume();
        if (!costume) {
            throw new Error("This guy has no costume!")
            // return;
        }

        console.log("Trying to render...")

        const image = costume.texture!;

        this.renderer.drawImage(
            image, 
            drawable.x, 
            drawable.y, 
            drawable.size / 100, 
            drawable.rotation
        );
    }

    public async addDrawable(id: string, drawable: Drawable) {
        const costume = drawable.getCostume();
        if (!costume) {
            throw new Error("this sprite doesn't have a costume!");
            // return;
        }

        if (!costume.texture) {
            console.log("No texture; generating one.")
            costume.texture = await getTexture(this.gl, costume.fsPath, costume.extension);
        }

        this.drawables.set(id, drawable);
    }

    public removeDrawable(id: string) {
        const drawable = this.drawables.get(id);
        
        for (const costume of drawable!.costumes) {
            this.gl.deleteTexture(costume);
        }

        this.drawables.delete(id);
    }
}