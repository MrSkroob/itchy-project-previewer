import { STAGE_HEIGHT, STAGE_WIDTH } from "./common/constants";
import { type BaseInstance } from "./vm/objects";


enum MonitorType {
    VARIABLE,
    LIST
}


export class MonitorHandler {
    private monitors: Map<string, Monitor> = new Map();
    private monitorCount = 0;

    constructor() {

    }


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