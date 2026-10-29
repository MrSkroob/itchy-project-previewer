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
    protected element: HTMLDivElement | null;
    private visibilityToggle?: HTMLDivElement;
    public name: string;
    public owner?: BaseInstance;
    private x: number;
    private y: number;

    private offsetX = 0;
    private offsetY = 0;

    protected stageHTML: HTMLElement | null;
    // TODO: make default hidden in the future!
    public hidden = false;
    private dragging = false;

    constructor(
        stage: HTMLElement | null, 
        element: HTMLDivElement | null, 
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

        // if (funkyColour) {
        //     element.style.background = "var(--vscode-sideBar-background)";
        // }
        this.hidden = !data.visible;

        if (element && stage) {     
            const monitorLayer = stage.querySelector(
                ".variable-monitor-layer"
            );

            if (!monitorLayer) {
                throw new Error("Monitor layer not found");
            }       
            monitorLayer.appendChild(element);

            // stage.appendChild(this.element);

            element.addEventListener("pointerdown", this.onMouseDown);
            element.addEventListener("pointerup", this.onMouseUp);
            element.addEventListener("pointermove", this.onMouseMove);

            this.updatePosition();

            const visibilityToggle = cloneTemplate(document.querySelector("template#variable-toggle") as HTMLTemplateElement) as HTMLDivElement;

            visibilityToggle.querySelector("label")!.textContent = MonitorFactory.getDisplayName(data);
            visibilityToggle.querySelector("input")!.checked = data.visible;

            element.hidden = !data.visible;

            this.visibilityToggle = visibilityToggle;

            if (!funkyColour) {
                visibilityToggle.style.background = "var(--vscode-list-hoverBackground)";
            }

            const monitorToggleLayer = document.querySelector("#monitor-toggles") as HTMLDivElement;
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
    }

    public isList() {
        return false;
    }

    private onChange = (_: Event) => {
        if (!this.element) {
            return;
        }
        this.hidden = !this.hidden;
        this.element.hidden = this.hidden;
    }

    abstract setValue(value: any): void
    abstract getValue(): any

    private pointerToScratch(event: PointerEvent) {
        if (!this.stageHTML) {
            return {x: 0, y: 0};
        }
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

        this.element!.setPointerCapture(event.pointerId);

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
        if (!this.element) {
            return;
        }
        
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
        if (!this.element) { return; }
        this.element!.hidden = this.hidden;
    }

    public dispose() {
        if (!this.element || !this.visibilityToggle) { return; }
        this.element.remove();
        this.visibilityToggle.remove();
    }
}


export class VariableMonitor extends Monitor {
    public value: any = 0;
    private valueHTML?: HTMLLabelElement;


    constructor(
        stage: HTMLElement | null, 
        element: HTMLDivElement | null, 
        owner: BaseInstance, 
        data: VariableData, 
        funkyColour: boolean) {
        super(stage, element, owner, data, funkyColour);
        if (!this.element) { return; }
        this.valueHTML = this.element.querySelector(".monitor-value") as HTMLLabelElement;
    }

    public getValue() {
        return this.value;
    }

    public setValue(value: any) {
        this.value = value;
        if (!this.valueHTML) { return; }
        this.valueHTML.textContent = String(value);
    }
}


export class ListMonitor extends Monitor {
    public items: any[] = [];
    private entries: HTMLUListElement[] = [];

    constructor(
        stage: HTMLElement | null, 
        element: HTMLDivElement | null, 
        owner: BaseInstance, 
        data: VariableData, 
        funkyColour: boolean) {
        super(stage, element, owner, data, funkyColour);
        if (!this.element) { return; }
    }

    public override isList() {
        return true;
    }

    public getValue() {
        return this.items;
    }

    public setValue(value: any[]) {
        // this.items = value;
        this.clear();

        value.forEach(element => {
            this.append(element);
        });
    }

    public append(value: any) {
        this.items.push(value);

        if (this.element) {
            const entry = document.createElement("ul");
            entry.className = "monitor-list-entries";
            entry.textContent = String(value);
            this.entries.push(entry);
            this.element.appendChild(entry);
        }
    }

    // note that scratch expects index from 1
    public remove(index: number) {
        if (this.items.length < index) { return; }
        this.items.splice(index - 1, 1);
        if (!this.element) { return; }
        this.entries[index - 1].remove();
        this.entries.splice(index - 1, 1)
    }

    public clear() {
        this.items = []

        if (!this.element) { return; }

        this.entries.forEach(element => {
            element.remove();
        });

        this.entries = [];
    }

    public replace(value: any, index: number) {
        index -= 1;

        if (index >= this.items.length) { 
            return;
        }

        if (index < 0) {
            return;
        }

        this.items[index] = value;
        if (!this.element) { return; }
        this.entries[index].textContent = String(value);
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
        stage: HTMLElement | null, 
        owner: BaseInstance, 
        data: VariableData) {

        let element = null;

        if (stage && !owner.isClone) {
            element = document.createElement("div") as HTMLDivElement;
            const nameEntry = document.createElement("label");
            nameEntry.className = "monitor-name";
            
            nameEntry.textContent = MonitorFactory.getDisplayName(data);

            element.style.order = String(MonitorFactory.counter);
            element.appendChild(nameEntry);

            MonitorFactory.counter += 1;
        }

        switch (monitorType) {
            case MonitorType.LIST:
                if (element) {
                    element.className = "list-monitor";
                }
                return new ListMonitor(stage, element, owner, data, MonitorFactory.counter % 2 == 0);
            case MonitorType.VARIABLE:
                if (element) {
                    const valueEntry = document.createElement("label");
                    valueEntry.className = "monitor-value";
                    valueEntry.textContent = "0";
                    element.appendChild(valueEntry);
                    element.className = "variable-monitor";
                }
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
    public isClone?: boolean;

    public monitors: Map<string, Monitor> = new Map();
    protected _name: string;

    protected sprite: HTMLDivElement;
    protected stageHTML: HTMLElement;

    // cache of variable data (does not necessarily create new monitors.)
    protected variableData: Map<string, VariableData> = new Map();

    public updateVariableRegistry(variables: VariableData[]) {
        const getKey = (v: VariableData) => `${v.owner}:${v.name}`;

        const newVars = new Set(variables.map(getKey));

        this.variableData.forEach(element => {
            if (!newVars.has(getKey(element)) && element.owner === this.name) {
                this.removeVariable(element.name);
            }
        });

        variables.forEach(element => {
            this.variableData.set(element.name, element);
        });
    }

    public clearVariables() {
        for (const name of [...this.monitors.keys()]) {
            this.removeVariable(name);
        }
    }

    public removeVariable(variable: string) {
        const existingMonitor = this.monitors.get(variable);

            if (existingMonitor && !this.isClone) {
                MonitorFactory.getInstance().flagRemoval()
                existingMonitor.dispose();
            }

            this.monitors.delete(variable);
            this.variableData.delete(variable);
        return;
    }

    public getVariable(variable: string) {
        const existingVariable = this.monitors.get(variable);

        if (!existingVariable) {
            return;
        }

        return existingVariable;
        // return existingVariable.
    }

    public addVariable(variable: string) {
        this.makeVariable(variable, false);
    }

    public addList(variable: string) {
        this.makeVariable(variable, true);
    }

    private makeVariable(variable: string, is_list: boolean) {
        let variableData = this.variableData.get(variable);

        if (variableData) {
            variableData.x = variableData.x ?? -230;
            variableData.y = variableData.y ?? 170;
        } else {
            variableData = {
                name: variable,
                owner: this.name,
                type: is_list ? "list" : "variable",
                visible: false,
                x: -230,
                y: 170
            }

            this.variableData.set(variable, variableData);
        }

        let existingMonitor = this.monitors.get(variable);

        if (!existingMonitor) {
            if (is_list) {
                existingMonitor = MonitorFactory.getInstance().constructMonitor(MonitorType.LIST, 
                    this.stageHTML, this, variableData)
                this.monitors.set(variable, existingMonitor);
            } else {
                existingMonitor = MonitorFactory.getInstance().constructMonitor(MonitorType.VARIABLE, 
                    this.stageHTML, this, variableData)
                this.monitors.set(variable, existingMonitor);
            }
        }
        
        return existingMonitor;
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
        this.clearVariables();
        this.sprite.remove();
    }

    protected serialiseVariableData() {
        const variableData: Map<string, VariableData> = new Map();

        this.monitors.forEach(element => {
            variableData.set(element.name, {
                name: element.name,
                owner: element.owner!.name,
                type: element instanceof ListMonitor ? "list" : "variable",
                visible: !element.hidden,
                x: element.getX(),
                y: element.getY()
            });
        });

        return Array.from(variableData.entries());
    }


    protected deserialiseVariableData(data?: [string, VariableData][]) {
        if (data === undefined) {
            return;
        }
        // bare {} means this code crashes. for now we create another map
        // this is yucky; we ideally would have a reviver, but oh well.
        const mappedData = new Map<string, VariableData>(
            [...data].sort((a, b) => a[1].name.localeCompare(b[1].name))
        );
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
                this.addList(element.name);
            } else {
                this.addVariable(element.name);
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

        const clone = new BaseSprite(this.gl, data, this.stageHTML);

        this.monitors.forEach((monitor, name) => {
            const clonedMonitor = clone.monitors.get(name);

            if (!clonedMonitor) {
                return;
            }

            const value = monitor.getValue();

            clonedMonitor.setValue(
                monitor.isList() ? [...value] : value
            );
        });

        return clone;
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


