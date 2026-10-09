import { CostumeData } from "../../messageTypes";

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

    constructor(gl: WebGLRenderingContext, costumes: CostumeData[]) {
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
        // this.costume = image.texture;
        // this.costume.src = image.fsPath;
    }


    public setVisible(visible: boolean) {
        this._visible = visible;
    }


    public setRotation(rotation: number) {
        this._rotation = rotation;
    }


    public updatePosition() {

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
    private gl: WebGLRenderingContext;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

        if (!gl) {
            throw new Error("neither webgl2 nor webgl technologies are supported.")
        }

        this.gl = gl;
    }

    public render() {
        const gl = this.gl;

        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    private drawDrawable(drawable: Drawable) {
        const costume = drawable.getCostume();
    }

    public addDrawable(id: string, drawable: Drawable) {
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