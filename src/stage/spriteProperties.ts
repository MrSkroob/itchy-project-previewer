import { Workspace, BaseInstance } from "./vm/objects";
import { hasProperty } from "./common/ownershipUtils";

export const propertyTemplate = document.getElementById("property-input-template") as HTMLTemplateElement;
// const copyButtonTemplate = document.getElementById("copy-button-template") as HTMLTemplateElement;
export const codeSpaceHTML = document.getElementById("code-template") as HTMLElement;
export const codeTextHTML = document.getElementById("text-contents") as HTMLSpanElement;
const copyButtonTemplate = document.getElementById("copy-button-template") as HTMLTemplateElement;
const COPY_ICON =
    "M4 4V1h11v11h-3v3H1V4h3zm1 0h7v7h2V2H5v2zm6 1H2v9h9V5z";

const CHECK_ICON =
    "M6.27 10.87 2.7 7.3l1.06-1.06 2.51 2.51 5.97-5.97L13.3 3.84z";

function cloneTemplate(template: HTMLTemplateElement) {
    return (template.content
        .cloneNode(true) as DocumentFragment)
        .firstElementChild as HTMLElement | null;
}


export function cloneCopyButton() {
    return cloneTemplate(copyButtonTemplate)! as HTMLButtonElement;
}

interface HTMLElementWithValue {
    value: string;
}

export function handleCopyButton(button: HTMLButtonElement, input: HTMLElementWithValue) {
    button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(
            input.value
        );

        const path = button.querySelector<SVGPathElement>(
            "path"
        );

        if (!path) {
            return;
        }

        path.setAttribute("d", CHECK_ICON);

        setTimeout(() => {
            path.setAttribute("d", COPY_ICON);
        }, 1500);

        globalThis.vscode.postMessage({
            type: "copiedToClipboard",
        });
    });
}


export class CodeSpaceViewer {
    size: number = 100;
    x: number = 0;
    y: number = 0;
    rotation: number = 90;
    rotationStyle: string = "all around";
    costumeName: string = "";
    visible: boolean = true;

    public setValue(propertyName: string, value: any) {
        switch (propertyName) {
            case "size":
                this.size = value;
                break;
            case "x":
                this.x = value;
                break;
            case "y":
                this.y = value;
                break;
            case "rotationStyle":
                this.rotationStyle = value;
                break;
            case "rotation":
                this.rotation = value;
                break;
            case "costumeName":
                this.costumeName = value;
                break;
            case "visible":
                this.visible = value;
                break;
            default:
                break;
        }
        codeTextHTML.textContent = this.getCode();
    }

    public getCode() {
        let codeBlock = `    motion_pointindirection(${this.rotation});
    motion_gotoxy(${this.x}, ${this.y});
    looks_setsizeto(${this.size});
    motion_setrotationstyle("${this.rotationStyle}");`;

        if (this.costumeName) {
            codeBlock += `\n    looks_switchcostumeto("${this.costumeName}");`;
        }

        if (this.visible) {
            codeBlock += "\n    looks_show();";
        } else {
            codeBlock += "\n    looks_hide();";
        }

        const event = `event event_whenflagclicked() {
${codeBlock}
}`;

        return event;
    }
}

type BooleanProperty = "visible"

type NumberProperty = 
    | "x"
    | "y"
    | "size"
    | "rotation"
    | "costumeNumber"
    // | "rotationStyle"


type StringProperty =
    | "rotationStyle"
    | "name"
    | "costumeName";

// html element
interface Option {
    name: string,
    value: string | number
}

export type PropertyDefinition =
    | {
        options?: Option[];
        kind: "number";
        property: NumberProperty;
        label: string;
        global?: boolean; // means that this should persist between sprites. for example, the list of sprites shouldn't change if you've moved one.
        readonly: boolean
    }
    | {
        options?: Option[];
        kind: "string";
        property: StringProperty;
        label: string;
        global?: boolean;
        readonly: boolean;
    }
    | {
        property: BooleanProperty;
        kind: "boolean";
        label: string;
        global?: boolean;
        readonly: boolean
    };


export class PropertyViewer {
    private selectedSprite: BaseInstance | undefined;

    private node: HTMLElement;
    private property: PropertyDefinition;

    private propertyNameNode: HTMLElement;
    private propertyValueNode: HTMLElement;

    private input?: HTMLInputElement;
    private select?: HTMLSelectElement;

    private readonly: boolean;
    private codeSpaceViewer: CodeSpaceViewer;

    private workspace: Workspace;
    // private sprites: Map<string, BaseInstance>;

    // external method to be called which updates all property viewers.
    // private selector: (instance: BaseInstance) => void;

    constructor(
        parent: HTMLElement,
        template: HTMLTemplateElement,
        property: PropertyDefinition,
        codeSpaceViewer: CodeSpaceViewer,
        workspace: Workspace
    ) {
        this.codeSpaceViewer = codeSpaceViewer;
        this.property = property;
        this.readonly = property.readonly;
        this.workspace = workspace;

        const node = cloneTemplate(template);

        if (!node) {
            throw new Error("Property template must have a root element.");
        }

        this.node = node;

        const propertyNameNode =
            this.node.querySelector<HTMLElement>(".property-name");

        const propertyValueNode =
            this.node.querySelector<HTMLElement>(".property-input");

        if (!propertyNameNode || !propertyValueNode) {
            throw new Error("Property template is missing required elements.");
        }

        const button = cloneCopyButton(); 
        button.title = "Copy value";

        this.propertyNameNode = propertyNameNode;
        this.propertyValueNode = propertyValueNode;
        this.propertyValueNode.appendChild(button);

        this.propertyNameNode.textContent = property.label;

        if (property.kind === "boolean") {
            const input = document.createElement("input");
            this.input = input;
            this.input.type = "checkbox";
            this.propertyValueNode.append(input);
            this.propertyValueNode.addEventListener("change", this.onChange);
        } else if (property.options) {
            this.propertyValueNode.appendChild(this.buildOptions(property.options));
        } else {
            const input = document.createElement("input");
            input.readOnly = this.readonly;
            this.input = input;
            this.input.className = "text";
            this.propertyValueNode.appendChild(input);
            this.propertyValueNode.addEventListener("change", this.onChange);

            if (property.kind === "string") {
                this.input.style.minWidth = "100px";
            }
            else if (property.kind === "number") {
                this.input.style.minWidth = "45px";
            }
        }

        handleCopyButton(button, {value: String(this.getInputValue())});
        parent.appendChild(this.node);
    }

    private buildOptions(options: Option[]) {
        let select: HTMLSelectElement;
        let isExisting = this.select !== undefined;
        if (this.select) {
            this.select.replaceChildren();
            select = this.select;
        } else {
            select = document.createElement("select");
        }

        for (const option of options) {
            const selection = document.createElement("option");

            selection.value = String(option.value);
            selection.textContent = option.name;

            select.appendChild(selection);
        }

        this.select = select;
        this.select.className = "text";
        if (!isExisting) {
            this.propertyValueNode.appendChild(select);  
        }
        this.select.addEventListener("change", this.onChange);
        this.select.style.minWidth = "120px";

        return select;
    }

    private costumeOptions(sprite: BaseInstance) {
        const options: Option[] = [];
        sprite.getCostumeMap().forEach(
            (_: number, costumeName: string) => {
                options.push({
                    name: costumeName,
                    value: costumeName
                });
            }
        );

        return options;
    }

    private spriteNames(sprites: Map<string, BaseInstance>) {
        const options: Option[] = [];
        sprites.forEach(
            (_: BaseInstance, key: string) => {
                options.push(
                    {
                        name: key,
                        value: key
                    }
                );
            }
        );
        return options;
    }

    private getFillInOptions(optionName: string, sprite?: BaseInstance): Option[] | null {
        switch (optionName) {
            case "costumeName":
                if (!sprite) {
                    break;
                }
                return this.costumeOptions(sprite);    
            case "name":
                return this.spriteNames(this.workspace.sprites);
            default:
                break;
        }
        return null;
    }

    public getInput() {
        if (this.select) {
            return this.select;
        }

        if (this.input) {
            return this.input;
        }

        throw new Error("this doesn't have any inputs...");
    }

    public getInputValue() {
        const inputHTML = this.getInput();

        if (inputHTML.type === "checkbox") {
            return inputHTML.checked;
        } else {
            return inputHTML.value;
        }
    }

    public setInputValue(value: any) {
        const inputHTML = this.getInput();

        if (inputHTML.type === "checkbox") {
            inputHTML.checked = Boolean(value);
        } else {
            inputHTML.value = String(value);
        }
    }

    private onChange = (_: Event) => {
        if (!this.selectedSprite) {
            return;
        }
        
        const input = this.getInputValue();

        // technically we don't need this as the entry would be disabled, so onChange never gets fired.
        // we have this to shut the compiler up.
        if (!hasProperty(this.selectedSprite, this.property.property)) {
            return;
        }

        const oldValue = String(this.selectedSprite[this.property.property]);

        if (this.readonly) {
            this.setInputValue(oldValue);
            return;
        }

        if (this.property.property === "name") {
            const sprite = this.workspace.sprites.get(String(input));
            if (!sprite) { return; }
            this.selectSprite(sprite, false);
            this.workspace.targetViewers(sprite);
            return;
        }

        let value: number | string | boolean;
        if (this.property.kind === "number") {
            value = Number(input);
            if (Number.isNaN(value)) {
                return;
            }
            this.selectedSprite[this.property.property] = value; 
        }
        else if (this.property.kind === "boolean") {
            value = Boolean(input);
            this.selectedSprite[this.property.property] = value;
        }
        else {
            value = String(input);
            this.selectedSprite[this.property.property] = value; 
        }

        this.codeSpaceViewer.setValue(this.property.property, value);
    };

    public rebuild(refreshGlobals?: boolean) {
        if (refreshGlobals || !this.property.global) {
            const options = this.getFillInOptions(this.property.property, this.selectedSprite);
            if (options) {
                this.buildOptions(options);
            }
        }

        this.update();
    }

    public selectSprite(sprite?: BaseInstance, refreshGlobals?: boolean) {
        this.selectedSprite = sprite;
        // we need to operate in this order; when drop downs get rebuilt, their values get reset. having
        // update first means their correct value gets overriden
        this.rebuild(refreshGlobals);
    }

    public clear() {
        this.selectedSprite = undefined;
    }

    public update() {
        if (!this.selectedSprite) {
            this.getInput().disabled = true;
            return;
        }

        if (!hasProperty(this.selectedSprite, this.property.property)) {
            this.getInput().disabled = true;
            return;
        }
        
        this.getInput().disabled = false;

        const value = this.selectedSprite[this.property.property];

        this.propertyNameNode.textContent = this.property.label;

        if (typeof(value) === "boolean") {
            (this.getInput() as HTMLInputElement).checked = value;
        } else {
            this.getInput().value = String(value);
        }

        this.codeSpaceViewer.setValue(this.property.property, value);
    }
}
