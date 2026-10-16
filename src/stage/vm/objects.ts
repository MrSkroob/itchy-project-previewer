import { ObjectState, SpriteData, VariableData } from "../messageTypes";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../common/constants";
// import { getTexture } from "../renderer/rendererUtils";
import { cloneTemplate } from "../spriteProperties";
import { Drawable } from "../renderer/renderer";
// import * as maths from "../common/mathsUtils";


enum MonitorType {
    VARIABLE,
    LIST
}


// export class MonitorHandler {
//     private monitors: Map<string, Monitor> = new Map();
//     private monitorCount = 0;

//     public addMonitor(monitor: Monitor) {
//         this.monitorCount += 1;
//         this.monitors.set((monitor.owner && monitor.owner.name) ?? "stage",  monitor);
//     }


//     public removeMonitor(monitor: Monitor) {
//         this.monitorCount -= 1;
//     }
// }


export abstract class Monitor {
    protected element: HTMLDivElement;
    private visibilityToggle: HTMLDivElement;
    public name: string;
    public owner?: BaseInstance;
    private x: number;
    private y: number;

    private offsetX = 0;
    private offsetY = 0;

    protected stageHTML;
    // TODO: make default hidden in the future!
    public hidden = false;
    private dragging = false;


    constructor(
        stage: HTMLElement, 
        element: HTMLDivElement, 
        owner: BaseInstance, 
        data: VariableData, 
        funkyColour: boolean) {
        // const element = document.createElement("div");
        this.name = data.name;
        // this.displayName = 
        this.stageHTML = stage;
        // this.element = element;
        // this.element.className = "monitor";
        this.element = element;
        this.owner = owner;

        this.x = data.x!;
        this.y = data.y!;

        const monitorLayer = stage.querySelector(
            ".variable-monitor-layer"
        );

        if (!monitorLayer) {
            throw new Error("Monitor layer not found");
        }

        // if (funkyColour) {
        //     element.style.background = "var(--vscode-sideBar-background)";
        // }

        monitorLayer.appendChild(this.element);

        // stage.appendChild(this.element);

        element.addEventListener("pointerdown", this.onMouseDown);
        element.addEventListener("pointerup", this.onMouseUp);
        element.addEventListener("pointermove", this.onMouseMove);

        this.updatePosition();

        const visibilityToggle = cloneTemplate(document.querySelector("template#variable-toggle") as HTMLTemplateElement) as HTMLDivElement;

        visibilityToggle.querySelector("label")!.textContent = MonitorFactory.getDisplayName(data);
        visibilityToggle.querySelector("input")!.checked = data.visible;

        this.hidden = !data.visible;
        element.hidden = !data.visible;

        this.visibilityToggle = visibilityToggle;

        const monitorToggleLayer = document.querySelector("#monitors") as HTMLDivElement;
        monitorToggleLayer.appendChild(visibilityToggle);

        // create visibility toggle
        /*
        template id="variable-toggle">
            <div class="variable-toggle">
                <label></label>
                <input type="checkbox">
            </div>
        </template>
        */

        visibilityToggle.addEventListener("change", this.onChange);
    }

    private onChange = (_: Event) => {
        this.hidden = !this.hidden;
        this.element.hidden = this.hidden;
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
        this.updatePosition();     
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

        this.updatePosition();
    };

    public updatePosition() {
        this.element.style.left =
            `${this.x + STAGE_WIDTH / 2}px`;

        this.element.style.top =
            `${STAGE_HEIGHT / 2 - this.y}px`;
    }

    public getX() {
        return this.x;
    }

    public getY() {
        return this.y;
    }

    public setVisible(){
        this.element.hidden = this.hidden;
    }

    public dispose() {
        this.element.remove();
        this.visibilityToggle.remove();
    }
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

    
    public static getDisplayName(data: VariableData) {
        if (data.owner === "stage") {
            return data.name;
        } else {
            return `${data.owner}: ${data.name}`
        }
    }


    public constructMonitor(
        monitorType: MonitorType, 
        stage: HTMLElement, 
        owner: BaseInstance, 
        data: VariableData) {

        MonitorFactory.counter += 1;
        const element = document.createElement("div") as HTMLDivElement;
        const nameEntry = document.createElement("label");
        nameEntry.className = "monitor-name";
        
        nameEntry.textContent = MonitorFactory.getDisplayName(data);

        element.appendChild(nameEntry);

        switch (monitorType) {
            case MonitorType.LIST:
                element.className = "list-monitor";
                return new ListMonitor(stage, element, owner, data, MonitorFactory.counter % 2 == 0);
            case MonitorType.VARIABLE:
                const valueEntry = document.createElement("label");
                valueEntry.className = "monitor-value";
                valueEntry.textContent = "0";
                element.appendChild(valueEntry);
                element.className = "variable-monitor";
                return new VariableMonitor(stage, element, owner, data, MonitorFactory.counter % 2 == 0);
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

    // cache of variable data (does not necessarily create new monitors.)
    protected variableData: Map<string, VariableData> = new Map();

    public updateVariableRegistry(variables: VariableData[]) {
        // this function expects that the variables submitted are wholely unique. 
        const newVars = new Set(variables.map((value) => { return { name: value.name, owner: value.owner } }))

        // note that iterating through a map and mutating it is safe :]
        this.variableData.forEach(element => {
            // check if the 'new' variables don't exist in the old map (and this sprite owns that variable)
            // if so, delete them.
            if (!newVars.has({ name: element.name, owner: element.owner }) && element.owner === this.name) {
                this.setVariable(element.name);
            }
        });

        variables.forEach(element => {
            this.variableData.set(element.name, element);
        });
    }

    public clearVariables() {
        this.monitors.forEach(element => {
            element.dispose();
        });
        this.variables.clear();
        this.monitors.clear();
    }

    public setVariable(variable: string, value?: any) {
        if (value === undefined) {
            this.variables.delete(variable);
            
            const existingMonitor = this.monitors.get(variable);

            if (existingMonitor) {
                MonitorFactory.getInstance().flagRemoval()
                existingMonitor.dispose();
            }

            this.monitors.delete(variable);
            this.variableData.delete(variable);
            return;
        }

        let x = 0;
        let y = 0;

        let variableData = this.variableData.get(variable);

        if (variableData) {
            variableData.x = variableData.x ?? -230;
            variableData.y = variableData.y ?? 170;
        } else {
            variableData = {
                name: variable,
                owner: this.name,
                type: Array.isArray(value) ? "list" : "variable",
                visible: false,
                x: -230,
                y: 170
            }
        }

        if (!this.variables.get(variable)) {
            if (Array.isArray(value)) {
                this.monitors.set(variable, MonitorFactory.getInstance().constructMonitor(MonitorType.LIST, 
                    this.stageHTML, this, variableData));
            } else {
                this.monitors.set(variable, MonitorFactory.getInstance().constructMonitor(MonitorType.VARIABLE, 
                    this.stageHTML, this, variableData));
            }
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

    protected serialiseVariableData() {
        const variableData: Map<string, VariableData> = new Map();

        this.monitors.forEach(element => {
            variableData.set(element.name, {
                name: element.name,
                owner: element.owner!.name,
                type: element instanceof ListMonitor ? "list" : "variable",
                visible: element.hidden,
                x: element.getX(),
                y: element.getY()
            });
            console.log(element.name);
        });

        return Array.from(variableData.entries());
    }


    protected deserialiseVariableData(data?: [string, VariableData][]) {
        if (data === undefined) {
            return;
        }
        // bare {} means this code crashes. for now we create another map
        // this is yucky; we ideally would have a reviver, but oh well.
        const mappedData = new Map<string, VariableData>(data);
        mappedData.forEach(element => {
            let existingData = this.variableData.get(element.name);
            if (existingData) {
                // if exists, only modify, do not replace.
                // existingData.type = element.type;
                existingData.x = element.x;
                existingData.y = element.y;
                // we want to keep the x and y values specifically.
            } else {
                existingData = element;
            }

            this.variableData.set(existingData.name, existingData);

            if (existingData.type == "list") {
                this.setVariable(element.name, []);
            } else {
                this.setVariable(element.name, 0);
            }

            const existingMonitor = this.monitors.get(element.name)
            if (existingMonitor) {
                existingMonitor.updatePosition();
            }
        });
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
            variableState: super.serialiseVariableData(),
            costumeNumber: this.costumeNumber,
            rotation: 90,
            rotationStyle: "all around"
        };
    }

    public fromJSON(state: ObjectState) {
        this._name = state.name;
        this.costumeNumber = state.costumeNumber;
        super.deserialiseVariableData(state.variableState);
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
            variableState: super.serialiseVariableData(),
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
        super.deserialiseVariableData(state.variableState);
    }
}


