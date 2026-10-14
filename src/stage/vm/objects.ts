import { ObjectState, SpriteData } from "../messageTypes";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../common/constants";
import { getTexture } from "../renderer/rendererUtils";
import { Drawable } from "../renderer/renderer";
// import * as maths from "../common/mathsUtils";


enum MonitorType {
    VARIABLE,
    LIST
}


export class MonitorHandler {
    private monitors: Map<string, Monitor> = new Map();
    private monitorCount = 0;

    public addMonitor(monitor: Monitor) {
        this.monitorCount += 1;
        this.monitors.set((monitor.owner && monitor.owner.name) ?? "stage",  monitor);
    }


    public removeMonitor(monitor: Monitor) {
        this.monitorCount -= 1;
    }
}


export abstract class Monitor {
    protected element: HTMLDivElement;
    public name: string;
    public owner?: BaseInstance;
    private x: number;
    private y: number;

    private offsetX = 0;
    private offsetY = 0;

    protected stageHTML;
    private dragging = false;

    constructor(stage: HTMLElement, owner: BaseInstance, variableName: string, x: number, y: number) {
        const element = document.createElement("div");
        this.name = variableName;
        this.stageHTML = stage;
        this.element = element;
        this.element.className = "monitor";
        this.owner = owner;

        this.x = x;
        this.y = y;

        stage.appendChild(this.element);

        element.addEventListener("pointerdown", this.onMouseDown);
        element.addEventListener("pointerup", this.onMouseUp);
        element.addEventListener("pointermove", this.onMouseMove);
    }

    abstract setValue(value: any): void

    private pointerToScratch(event: PointerEvent) {
        const stageRect = this.stageHTML.getBoundingClientRect();

        const scaleX = stageRect.width / STAGE_WIDTH;
        const scaleY = stageRect.height / STAGE_HEIGHT;

        const stageX =
            (event.clientX - stageRect.left) / scaleX;

        const stageY =
            (event.clientY - stageRect.top) / scaleY;

        return {
            x: stageX - STAGE_WIDTH / 2,
            y: STAGE_HEIGHT / 2 - stageY
        };
    }

    private onMouseMove = (event: PointerEvent) => {
        if (!this.dragging) {
            return;
        }

        const pointer = this.pointerToScratch(event);
        // this._x = pointer.x;
        // this._y = pointer.y;

        this.x = pointer.x - this.offsetX;
        this.y = pointer.y - this.offsetY;        
    };

    private onMouseDown = (event: PointerEvent) => {
        this.dragging = true;
        const pointer = this.pointerToScratch(event);

        this.element.setPointerCapture(event.pointerId);

        // Remember where inside the sprite the user clicked.
        this.offsetX = pointer.x - this.x;
        this.offsetY = pointer.y - this.y;

        // this.parent.bringToFront(this);
    };

    private onMouseUp = (event: PointerEvent) => {
        if (!this.dragging) {
            return;
        }

        this.dragging = false;

        const pointer = this.pointerToScratch(event);

        // Preserve the original click offset.
        this.x = (pointer.x - this.offsetX);
        this.y = (pointer.y - this.offsetY);

        this.offsetX = 0;
        this.offsetY = 0;

    };
}


export class VariableMonitor extends Monitor {
    public value: any = 0;

    public setValue(value: any) {
        this.value = value;
    }

    public update() {
    }
}


export class ListMonitor extends Monitor {
    public items: any[] = [];

    public setValue(value: any[]) {
        this.items = value;
    }
}


class MonitorFactory {
    private static singleton: MonitorFactory;
    private static counter: number = 0;

    public static getInstance() {
        if (!this.singleton) {
            this.singleton = new MonitorFactory();
        }
        return this.singleton;
    }


    public constructMonitor(
        monitorType: MonitorType, 
        stage: HTMLElement, 
        owner: BaseInstance, 
        variableName: string, 
        x: number, 
        y: number) {

        MonitorFactory.counter += 1;

        switch (monitorType) {
            case MonitorType.LIST:
                return new ListMonitor(stage, owner, variableName, x, y)
            case MonitorType.VARIABLE:
                return new VariableMonitor(stage, owner, variableName, x, y)
        }
    }

    public flagRemoval() {
        MonitorFactory.counter -= 1;
    }
}


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

    protected monitors: Map<String, Monitor> = new Map();
    protected _name: string;

    protected sprite: HTMLDivElement;
    protected stageHTML: HTMLElement;

    public setVariable(variable: string, value: any) {
        if (!this.variables.get(variable)) {
            if (Array.isArray(value)) {
                this.monitors.set(variable, new ListMonitor(this.stageHTML, this, variable, 0, 0));
            } else {
                this.monitors.set(variable, new VariableMonitor(this.stageHTML, this, variable, 0, 0));
            }
            // this.monitors.set()
        }

        this.variables.set(variable, value);
        
        this.monitors.get(variable)
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


