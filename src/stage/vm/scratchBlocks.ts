/**
 * Scratch 3 block implementations for the Itchy preview VM.
 *
 * All block functions accept the execution context as their first argument.
 * Stack/command blocks are generators, even if they do not need to yield,
 * so generated code can always use `yield* ScratchBlock.some_opcode(...)`.
 * Reporter and boolean blocks return their value synchronously.
 *
 * Control structures (if/else, loops, repeat, forever) are emitted as native
 * JavaScript by the compiler, with cooperative yields inserted by the compiler.
 * This module only implements primitive Scratch commands/reporters.
 * VM-owned functionality is accessed via context.vm; optional host services
 * remain only for capabilities not provided by ItchyVM.
 *
 * Place this file alongside itchyVM.ts and objects.ts: src/stage/vm/scratchBlocks.ts
 */

import { EventType, ExecutionContext, ItchyVM, ThreadGenerator, ScratchServices } from "./itchyVM";
import { BaseInstance, BaseSprite } from "./objects";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../common/constants";

type Value = unknown;
type Condition = Value | (() => Value);
type ListValue = unknown[];


export type ScratchContext = ExecutionContext & { scratch?: ScratchServices };

// --------------------------------------------------------------------------
// Scratch casting and shared helpers
// --------------------------------------------------------------------------

function number(value: Value): number {
    // Scratch arithmetic uses zero for non-numeric strings and NaN.
    if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value == null) return 0;
    const converted = Number(String(value));
    return Number.isNaN(converted) ? 0 : converted;
}

function string(value: Value): string {
    if (value == null) return "";
    return String(value);
}

function bool(value: Value): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
    if (value == null) return false;
    const s = string(value).trim().toLowerCase();
    return s !== "" && s !== "0" && s !== "false";
}

function evaluate(condition: Condition): boolean {
    return bool(typeof condition === "function" ? condition() : condition);
}

function compare(a: Value, b: Value): number {
    const sa = string(a);
    const sb = string(b);
    // Empty/whitespace-only strings are compared lexicographically.
    const na = Number(sa);
    const nb = Number(sb);
    if (sa.trim() && sb.trim() && Number.isFinite(na) && Number.isFinite(nb)) {
        return na < nb ? -1 : na > nb ? 1 : 0;
    }
    const left = sa.toLowerCase();
    const right = sb.toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
}

function sprite(context: ExecutionContext): BaseSprite | undefined {
    return context.sprite;
}

function instance(context: ExecutionContext): BaseInstance {
    return context.sprite ?? context.backdrop;
}

function requireSprite(context: ExecutionContext): BaseSprite {
    const result = sprite(context);
    if (!result) throw new Error("Motion / sprite-only block called on the Stage");
    return result;
}

function requireVM(context: ExecutionContext): ItchyVM {
    if (!context.vm) {
        throw new Error("This block must execute inside an ItchyVM thread");
    }
    return context.vm;
}

function getServices(context: ExecutionContext): ScratchServices | undefined {
    return (context as ScratchContext).scratch;
}

function requireService<K extends keyof ScratchServices>(
    context: ExecutionContext, name: K
): NonNullable<ScratchServices[K]> {
    const service = getServices(context)?.[name];
    if (service == null) throw new Error(`Scratch block requires context.scratch.${name}`);
    return service as NonNullable<ScratchServices[K]>;
}

function namedTarget(context: ExecutionContext, name: Value): BaseInstance | undefined {
    const target = string(name);
    if (target === "_stage_" || target === "Stage") return;
    if (context.sprite?.name === target) return context.sprite;

    // context.vm.s

    return getServices(context)?.targets?.get(target);
}

function stageElement(context: ExecutionContext): HTMLElement | null {
    return getServices(context)?.stageElement ?? document.getElementById("stage-container");
}

function normaliseDirection(degrees: number): number {
    return ((degrees + 180) % 360 + 360) % 360 - 180;
}

function fromDirection(degrees: number) {
    const radians = (degrees * Math.PI) / 180;
    return { x: Math.sin(radians), y: Math.cos(radians) };
}

function towards(x1: number, y1: number, x2: number, y2: number): number {
    return normaliseDirection(Math.atan2(x2 - x1, y2 - y1) * 180 / Math.PI);
}

function randomBetween(a: number, b: number): number {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    if (Number.isInteger(low) && Number.isInteger(high)) {
        return Math.floor(Math.random() * (high - low + 1)) + low;
    }
    return low + Math.random() * (high - low);
}

function mouseCoordinates(context: ExecutionContext) {
    const stage = stageElement(context);
    if (!stage || !pointerSeen) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
        x: Math.round((pointerX - rect.left) / rect.width * STAGE_WIDTH - STAGE_WIDTH / 2),
        y: Math.round(STAGE_HEIGHT / 2 - (pointerY - rect.top) / rect.height * STAGE_HEIGHT)
    };
}

// Mouse input is not exposed by ItchyVM, so it is tracked by the preview UI.
let pointerSeen = false;
let pointerX = 0;
let pointerY = 0;
let pointerDown = false;
if (typeof window !== "undefined") {
    window.addEventListener("blur", () => { pointerDown = false; });
    window.addEventListener("pointermove", e => {
        pointerSeen = true;
        pointerX = e.clientX;
        pointerY = e.clientY;
    });
    window.addEventListener("pointerdown", e => {
        pointerSeen = true;
        pointerX = e.clientX;
        pointerY = e.clientY;
        pointerDown = true;
    });
    window.addEventListener("pointerup", () => { pointerDown = false; });
}

function scratchKeyToCode(key: string): string {
    const k = key.toLowerCase();
    const names: Record<string, string> = {
        "space": "Space", "up arrow": "ArrowUp", "down arrow": "ArrowDown",
        "left arrow": "ArrowLeft", "right arrow": "ArrowRight",
        "enter": "Enter", "any": "any"
    };
    if (names[k]) return names[k];
    if (/^[a-z]$/.test(k)) return "Key" + k.toUpperCase();
    if (/^[0-9]$/.test(k)) return "Digit" + k;
    return key;
}

function boundingRect(target: BaseSprite): DOMRect | undefined {
    return target.getSprite().querySelector("img")?.getBoundingClientRect();
}

function intersects(a: DOMRect, b: DOMRect): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// --------------------------------------------------------------------------
// Motion
// --------------------------------------------------------------------------

export function* motion_movesteps(context: ExecutionContext, steps: Value): ThreadGenerator {
    const s = requireSprite(context);
    const velocity = fromDirection(s.rotation);
    s.x += velocity.x * number(steps);
    s.y += velocity.y * number(steps);
}

export function* motion_turnright(context: ExecutionContext, degrees: Value): ThreadGenerator {
    const s = requireSprite(context);
    s.rotation = normaliseDirection(s.rotation + number(degrees));
}

export function* motion_turnleft(context: ExecutionContext, degrees: Value): ThreadGenerator {
    const s = requireSprite(context);
    s.rotation = normaliseDirection(s.rotation - number(degrees));
}

export function* motion_pointindirection(context: ExecutionContext, direction: Value): ThreadGenerator {
    requireSprite(context).rotation = normaliseDirection(number(direction));
}

export function* motion_pointtowards(context: ExecutionContext, targetName: Value): ThreadGenerator {
    const s = requireSprite(context);
    const target = string(targetName);
    const coordinates = target === "_mouse_" ? mouseCoordinates(context)
        : namedTarget(context, target);
    if (coordinates && "x" in coordinates && "y" in coordinates) {
        const dx = number(coordinates.x) - s.x;
        const dy = number(coordinates.y) - s.y;
        if (dx !== 0 || dy !== 0) s.rotation = towards(s.x, s.y, s.x + dx, s.y + dy);
    }
}

export function* motion_gotoxy(context: ExecutionContext, x: Value, y: Value): ThreadGenerator {
    const s = requireSprite(context);
    s.x = number(x);
    s.y = number(y);
}

function resolveTarget(context: ExecutionContext, target: Value): { x: number; y: number } | undefined {
    const name = string(target);
    if (name === "_random_") {
        return { x: randomBetween(-STAGE_WIDTH / 2, STAGE_WIDTH / 2),
                 y: randomBetween(-STAGE_HEIGHT / 2, STAGE_HEIGHT / 2) };
    }
    if (name === "_mouse_") return mouseCoordinates(context);
    const other = namedTarget(context, name);
    return other instanceof BaseSprite ? { x: other.x, y: other.y } : undefined;
}

export function* motion_goto(context: ExecutionContext, target: Value): ThreadGenerator {
    const position = resolveTarget(context, target);
    if (position) yield* motion_gotoxy(context, position.x, position.y);
}

export function* motion_changexby(context: ExecutionContext, dx: Value): ThreadGenerator {
    const s = requireSprite(context);
    s.x += number(dx);
}

export function* motion_setx(context: ExecutionContext, x: Value): ThreadGenerator {
    requireSprite(context).x = number(x);
}

export function* motion_changeyby(context: ExecutionContext, dy: Value): ThreadGenerator {
    const s = requireSprite(context);
    s.y += number(dy);
}

export function* motion_sety(context: ExecutionContext, y: Value): ThreadGenerator {
    requireSprite(context).y = number(y);
}

export function* motion_ifonedgebounce(context: ExecutionContext): ThreadGenerator {
    const s = requireSprite(context);
    const halfWidth = STAGE_WIDTH / 2;
    const halfHeight = STAGE_HEIGHT / 2;
    const hitX = s.x <= -halfWidth || s.x >= halfWidth;
    const hitY = s.y <= -halfHeight || s.y >= halfHeight;
    if (!hitX && !hitY) return;

    const direction = fromDirection(s.rotation);
    if (hitX) direction.x = -direction.x;
    if (hitY) direction.y = -direction.y;
    s.rotation = towards(0, 0, direction.x, direction.y);
    s.x = Math.max(-halfWidth, Math.min(halfWidth, s.x));
    s.y = Math.max(-halfHeight, Math.min(halfHeight, s.y));
}

export function* motion_setrotationstyle(context: ExecutionContext, style: Value): ThreadGenerator {
    const value = string(style);
    if (["all around", "left-right", "don't rotate"].includes(value)) {
        requireSprite(context).rotationStyle = value;
    }
}

export function motion_xposition(context: ExecutionContext): number {
    return requireSprite(context).x;
}

export function motion_yposition(context: ExecutionContext): number {
    return requireSprite(context).y;
}

export function motion_direction(context: ExecutionContext): number {
    return normaliseDirection(requireSprite(context).rotation);
}

export function* motion_glidesecstoxy(
    context: ExecutionContext, seconds: Value, x: Value, y: Value
): ThreadGenerator {
    const s = requireSprite(context);
    const duration = Math.max(0, number(seconds) * 1000);
    const startX = s.x;
    const startY = s.y;
    const endX = number(x);
    const endY = number(y);
    if (duration === 0) {
        s.x = endX;
        s.y = endY;
        return;
    }
    const startTime = performance.now();
    while (true) {
        const progress = Math.min(1, (performance.now() - startTime) / duration);
        s.x = startX + (endX - startX) * progress;
        s.y = startY + (endY - startY) * progress;
        if (progress >= 1) break;
        yield { type: "waitOneFrame" };
    }
}

export function* motion_glideto(context: ExecutionContext, seconds: Value, target: Value): ThreadGenerator {
    const position = resolveTarget(context, target);
    if (position) yield* motion_glidesecstoxy(context, seconds, position.x, position.y);
}

// --------------------------------------------------------------------------
// Looks: visibility, size, costumes, backdrops
// --------------------------------------------------------------------------

export function* looks_show(context: ExecutionContext): ThreadGenerator {
    requireSprite(context).visible = true;
}

export function* looks_hide(context: ExecutionContext): ThreadGenerator {
    requireSprite(context).visible = false;
}

export function* looks_setsizeto(context: ExecutionContext, percentage: Value): ThreadGenerator {
    requireSprite(context).size = Math.max(0, number(percentage));
}

export function* looks_changesizeby(context: ExecutionContext, percentage: Value): ThreadGenerator {
    const s = requireSprite(context);
    s.size = Math.max(0, s.size + number(percentage));
}

export function looks_size(context: ExecutionContext): number {
    return requireSprite(context).size;
}

function switchCostume(target: BaseInstance, selection: Value): void {
    const text = string(selection);
    const index = target.getCostumeMap().get(text);
    if (index !== undefined) {
        target.costumeNumber = index;
    } else if (text === "next costume" || text === "next backdrop") {
        target.costumeNumber = (target.costumeNumber + 1) % Math.max(1, target.costumes.length);
    } else if (text === "previous costume" || text === "previous backdrop") {
        target.costumeNumber = (target.costumeNumber - 1 + target.costumes.length) % Math.max(1, target.costumes.length);
    } else if (text.trim() !== "" && Number.isFinite(Number(text))) {
        const n = target.costumes.length;
        if (n) target.costumeNumber = ((Math.floor(number(selection)) - 1) % n + n) % n;
    }
}

export function* looks_switchcostumeto(context: ExecutionContext, selection: Value): ThreadGenerator {
    switchCostume(requireSprite(context), selection);
}

export function* looks_nextcostume(context: ExecutionContext): ThreadGenerator {
    switchCostume(requireSprite(context), "next costume");
}

function switchBackdropAndFire(context: ExecutionContext, selection: Value) {
    const oldNumber = context.backdrop.costumeNumber;
    switchCostume(context.backdrop, selection);
    if (context.backdrop.costumeNumber !== oldNumber) {
        return requireVM(context).fireGlobalEvent(EventType.BACKDROP_CHANGE);
    }
}

export function* looks_switchbackdropto(context: ExecutionContext, selection: Value): ThreadGenerator {
    switchBackdropAndFire(context, selection);
}

export function* looks_switchbackdroptoandwait(context: ExecutionContext, selection: Value): ThreadGenerator {
    const run = switchBackdropAndFire(context, selection);
    if (run) yield { type: "waitingFor", event: run };
}

export function* looks_nextbackdrop(context: ExecutionContext): ThreadGenerator {
    switchBackdropAndFire(context, "next backdrop");
}

export function looks_costumenumbername(context: ExecutionContext, numberOrName: Value): number | string {
    const s = requireSprite(context);
    return string(numberOrName).toLowerCase() === "name" ? s.costumeName : s.costumeNumber + 1;
}

export function looks_backdropnumbername(context: ExecutionContext, numberOrName: Value): number | string {
    const b = context.backdrop;
    return string(numberOrName).toLowerCase() === "name" ? b.costumeName : b.costumeNumber + 1;
}

export function* looks_gotofrontback(context: ExecutionContext, direction: Value): ThreadGenerator {
    const s = requireSprite(context);
    if (string(direction).toLowerCase() === "front") {
        requireService(context, "bringToFront")(s);
    } else {
        requireService(context, "moveLayers")(s, "backward", Infinity);
    }
}

export function* looks_goforwardbackwardlayers(
    context: ExecutionContext, direction: Value, amount: Value
): ThreadGenerator {
    const s = requireSprite(context);
    const forwards = string(direction).toLowerCase() === "forward";
    requireService(context, "moveLayers")(s, forwards ? "forward" : "backward", number(amount));
}

// --------------------------------------------------------------------------
// Control: primitive operations only. Branches/loops are native JS in emitted code.
// --------------------------------------------------------------------------

export function* control_wait(_context: ExecutionContext, seconds: Value): ThreadGenerator {
    const n = number(seconds);
    if (n <= 0) yield { type: "waitOneFrame" };
    else yield { type: "wait", seconds: n };
}

// "wait until" is a wait primitive, not a control-flow body/branch.
export function* control_wait_until(_context: ExecutionContext, condition: Condition): ThreadGenerator {
    if (!evaluate(condition)) {
        yield { type: "waitUntil", condition: () => evaluate(condition) };
    }
}

export function* control_create_clone_of(context: ExecutionContext, targetName: Value): ThreadGenerator {
    const name = string(targetName);
    const target = name === "_myself_" ? context.sprite : namedTarget(context, name);
    if (!(target instanceof BaseSprite)) return;
    const clone = getServices(context)?.createClone?.(target) ?? target.clone();
    // Clones inherit the original sprite's variable/list state.
    clone.variables = new Map(
        [...target.variables].map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
    );
    requireVM(context).fireInstanceEvent(EventType.CLONE, clone);
}

export function* control_delete_this_clone(context: ExecutionContext): ThreadGenerator {
    const s = requireSprite(context);
    if (!s.isClone) return;
    // Removing a clone must also terminate any scripts running on that instance.
    requireVM(context).stopInstanceScripts(s);
    const deleteClone = getServices(context)?.deleteClone;
    if (deleteClone) deleteClone(s);
    else s.remove();
    yield { type: "waitOneFrame" };
}

export function* control_stop(context: ExecutionContext, scope: Value): ThreadGenerator {
    if (string(scope) === "all") {
        requireVM(context).stop();
        // VM.stop() marks the running thread done; don't resume its script.
        yield { type: "waitOneFrame" };
        return;
    }
    throw new Error(`control_stop(${string(scope)}) requires a current-thread API in ItchyVM`);
}

// --------------------------------------------------------------------------
// Events: hats are registered by generated code, not executed as blocks.
// --------------------------------------------------------------------------

export function* event_broadcast(context: ExecutionContext, message: Value): ThreadGenerator {
    requireVM(context).fireGlobalEvent(EventType.MESSAGE, string(message));
}

export function* event_broadcastandwait(context: ExecutionContext, message: Value): ThreadGenerator {
    const run = requireVM(context).fireGlobalEvent(EventType.MESSAGE, string(message));
    yield { type: "waitingFor", event: run };
}

// --------------------------------------------------------------------------
// Operators
// --------------------------------------------------------------------------

export function operator_add(_context: ExecutionContext, a: Value, b: Value): number { return number(a) + number(b); }
export function operator_subtract(_context: ExecutionContext, a: Value, b: Value): number { return number(a) - number(b); }
export function operator_multiply(_context: ExecutionContext, a: Value, b: Value): number { return number(a) * number(b); }
export function operator_divide(_context: ExecutionContext, a: Value, b: Value): number { return number(a) / number(b); }
export function operator_gt(_context: ExecutionContext, a: Value, b: Value): boolean { return compare(a, b) > 0; }
export function operator_lt(_context: ExecutionContext, a: Value, b: Value): boolean { return compare(a, b) < 0; }
export function operator_equals(_context: ExecutionContext, a: Value, b: Value): boolean { return compare(a, b) === 0; }
export function operator_and(_context: ExecutionContext, a: Value, b: Value): boolean { return bool(a) && bool(b); }
export function operator_or(_context: ExecutionContext, a: Value, b: Value): boolean { return bool(a) || bool(b); }
export function operator_not(_context: ExecutionContext, value: Value): boolean { return !bool(value); }
export function operator_join(_context: ExecutionContext, a: Value, b: Value): string { return string(a) + string(b); }
export function operator_length(_context: ExecutionContext, value: Value): number { return string(value).length; }
export function operator_round(_context: ExecutionContext, value: Value): number { return Math.round(number(value)); }
export function operator_random(_context: ExecutionContext, low: Value, high: Value): number {
    return randomBetween(number(low), number(high));
}
export function operator_mod(_context: ExecutionContext, a: Value, b: Value): number {
    const divisor = number(b);
    return ((number(a) % divisor) + divisor) % divisor;
}
export function operator_letter_of(_context: ExecutionContext, index: Value, value: Value): string {
    const text = string(value);
    const i = Math.floor(number(index)) - 1;
    return text[i] ?? "";
}
export function operator_contains(_context: ExecutionContext, haystack: Value, needle: Value): boolean {
    return string(haystack).toLowerCase().includes(string(needle).toLowerCase());
}
export function operator_mathop(_context: ExecutionContext, operation: Value, input: Value): number {
    const n = number(input);
    const radians = n * Math.PI / 180;
    switch (string(operation).toLowerCase()) {
        case "abs": return Math.abs(n);
        case "floor": return Math.floor(n);
        case "ceiling": return Math.ceil(n);
        case "sqrt": return Math.sqrt(n);
        case "sin": return Math.sin(radians);
        case "cos": return Math.cos(radians);
        case "tan": return Math.tan(radians);
        case "asin": return Math.asin(n) * 180 / Math.PI;
        case "acos": return Math.acos(n) * 180 / Math.PI;
        case "atan": return Math.atan(n) * 180 / Math.PI;
        case "ln": return Math.log(n);
        case "log": return Math.log10(n);
        case "e ^": return Math.exp(n);
        case "10 ^": return Math.pow(10, n);
        default: return 0;
    }
}

// --------------------------------------------------------------------------
// Variables and lists
// --------------------------------------------------------------------------

function variableOwner(context: ExecutionContext, name: string): BaseInstance {
    if (context.sprite?.variables.has(name)) return context.sprite;
    if (context.backdrop.variables.has(name)) return context.backdrop;
    return instance(context);
}

export function data_variable(context: ExecutionContext, name: Value): Value {
    return variableOwner(context, string(name)).variables.get(string(name)) ?? 0;
}

export function* data_setvariableto(context: ExecutionContext, name: Value, value: Value): ThreadGenerator {
    variableOwner(context, string(name)).setVariable(string(name), value);
}

export function* data_changevariableby(context: ExecutionContext, name: Value, delta: Value): ThreadGenerator {
    const owner = variableOwner(context, string(name));
    const old = owner.variables.get(string(name));
    owner.setVariable(string(name), number(old) + number(delta));
}

function list(context: ExecutionContext, name: Value): ListValue {
    const owner = variableOwner(context, string(name));
    const current = owner.variables.get(string(name));
    if (Array.isArray(current)) return current;
    const result: ListValue = [];
    owner.setVariable(string(name), result);
    return result;
}

function listIndex(index: Value, length: number, allowEnd = false): number {
    const s = string(index).toLowerCase();
    if (s === "last") return allowEnd ? length : length - 1;
    if (s === "random" || s === "any") {
        const size = length + (allowEnd ? 1 : 0);
        return size ? Math.floor(Math.random() * size) : -1;
    }
    const n = Math.floor(number(index)) - 1;
    return n >= 0 && n < length + (allowEnd ? 1 : 0) ? n : -1;
}

export function* data_addtolist(context: ExecutionContext, item: Value, listName: Value): ThreadGenerator {
    list(context, listName).push(item);
}

export function* data_deleteoflist(context: ExecutionContext, index: Value, listName: Value): ThreadGenerator {
    const items = list(context, listName);
    if (string(index).toLowerCase() === "all") {
        items.length = 0;
        return;
    }
    const i = listIndex(index, items.length);
    if (i >= 0) items.splice(i, 1);
}

export function* data_deletealloflist(context: ExecutionContext, listName: Value): ThreadGenerator {
    list(context, listName).length = 0;
}

export function* data_insertatlist(context: ExecutionContext, item: Value, index: Value, listName: Value): ThreadGenerator {
    const items = list(context, listName);
    const i = listIndex(index, items.length, true);
    if (i >= 0) items.splice(i, 0, item);
}

export function* data_replaceitemoflist(context: ExecutionContext, index: Value, listName: Value, item: Value): ThreadGenerator {
    const items = list(context, listName);
    const i = listIndex(index, items.length);
    if (i >= 0) items[i] = item;
}

export function data_itemoflist(context: ExecutionContext, index: Value, listName: Value): Value {
    const items = list(context, listName);
    const i = listIndex(index, items.length);
    return i >= 0 ? items[i] : "";
}

export function data_itemnumoflist(context: ExecutionContext, item: Value, listName: Value): number {
    const index = list(context, listName).findIndex(current => compare(current, item) === 0);
    return index === -1 ? 0 : index + 1;
}

export function data_lengthoflist(context: ExecutionContext, listName: Value): number {
    return list(context, listName).length;
}

export function data_listcontainsitem(context: ExecutionContext, listName: Value, item: Value): boolean {
    return data_itemnumoflist(context, item, listName) !== 0;
}

export function data_listcontents(context: ExecutionContext, listName: Value): string {
    const items = list(context, listName).map(string);
    return items.every(item => item.length === 1) ? items.join("") : items.join(" ");
}

// --------------------------------------------------------------------------
// Sensing
// --------------------------------------------------------------------------

export function sensing_mousex(context: ExecutionContext): number { return mouseCoordinates(context).x; }
export function sensing_mousey(context: ExecutionContext): number { return mouseCoordinates(context).y; }
export function sensing_mousedown(_context: ExecutionContext): boolean { return pointerDown; }

export function sensing_keypressed(context: ExecutionContext, key: Value): boolean {
    return requireVM(context).isKeyDown(scratchKeyToCode(string(key)));
}

export function sensing_distanceto(context: ExecutionContext, name: Value): number {
    const s = requireSprite(context);
    const target = string(name) === "_mouse_" ? mouseCoordinates(context) : resolveTarget(context, name);
    return target ? Math.hypot(target.x - s.x, target.y - s.y) : 10000;
}

export function sensing_touchingobject(context: ExecutionContext, targetName: Value): boolean {
    // TODO: use pixel perfect connection
    const s = requireSprite(context);
    const a = boundingRect(s);
    if (!a) return false;
    const name = string(targetName);
    let withinBounds = false;
    const target = namedTarget(context, name);
    if (name === "_edge_") {
        const stage = stageElement(context)?.getBoundingClientRect();
        withinBounds = stage ? a.left <= stage.left || a.right >= stage.right ||
            a.top <= stage.top || a.bottom >= stage.bottom : false;
    }
    else if (name === "_mouse_") withinBounds = pointerSeen &&
        pointerX >= a.left && pointerX <= a.right && pointerY >= a.top && pointerY <= a.bottom;
    else if (target instanceof BaseSprite && target.visible) {
        const b = boundingRect(target);
        withinBounds = Boolean(b && intersects(a, b));
    }

    // only do the (relatively) expensive pixel touching code 
    // if they are within bounds. 
    const service = getServices(context);
    if (withinBounds && target && service && service.touchingObject ) {
        return service.touchingObject(s, target);
    } else {
        return withinBounds;
    }
}

export function sensing_touchingcolor(context: ExecutionContext, color: Value): boolean {
    return requireService(context, "touchingColor")(requireSprite(context), string(color));
}

export function sensing_coloristouchingcolor(context: ExecutionContext, color1: Value, color2: Value): boolean {
    return requireService(context, "colorTouchingColor")(requireSprite(context), string(color1), string(color2));
}

export function sensing_of(context: ExecutionContext, property: Value, targetName: Value): Value {
    const target = namedTarget(context, targetName);
    if (!target) return 0;
    const key = string(property).toLowerCase();
    if (target instanceof BaseSprite) {
        switch (key) {
            case "x position": return target.x;
            case "y position": return target.y;
            case "direction": return target.rotation;
            case "size": return target.size;
            case "costume #": return target.costumeNumber + 1;
            case "costume name": return target.costumeName;
        }
    }
    switch (key) {
        case "backdrop #": return context.backdrop.costumeNumber + 1;
        case "backdrop name": return context.backdrop.costumeName;
    }
    return target.variables.get(string(property)) ?? 0;
}

let startTime = performance.now();
let latestAnswer = "";

export function sensing_timer(_context: ExecutionContext): number {
    return (performance.now() - startTime) / 1000;
}

export function* sensing_resettimer(_context: ExecutionContext): ThreadGenerator {
    startTime = performance.now();
}

export function sensing_answer(_context: ExecutionContext): string { return latestAnswer; }

export function* sensing_askandwait(context: ExecutionContext, question: Value): ThreadGenerator {
    const ask = requireService(context, "ask");
    let done = false;
    let error: unknown;
    Promise.resolve().then(() => ask(string(question)))
        .then(answer => { latestAnswer = string(answer); done = true; })
        .catch(reason => { error = reason; done = true; });
    yield { type: "waitUntil", condition: () => done };
    if (error !== undefined) throw error;
}

export function sensing_current(_context: ExecutionContext, unit: Value): number {
    const date = new Date();
    switch (string(unit).toLowerCase()) {
        case "year": return date.getFullYear();
        case "month": return date.getMonth() + 1;
        case "date": return date.getDate();
        case "dayofweek": return date.getDay() + 1; // Sunday = 1
        case "hour": return date.getHours();
        case "minute": return date.getMinutes();
        case "second": return date.getSeconds();
        default: return 0;
    }
}

export function sensing_dayssince2000(_context: ExecutionContext): number {
    return (Date.now() - Date.UTC(2000, 0, 1)) / 86_400_000;
}

export function sensing_username(context: ExecutionContext): string {
    return getServices(context)?.username?.() ?? "";
}
