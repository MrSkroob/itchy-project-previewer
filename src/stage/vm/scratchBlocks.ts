import { ExecutionContext } from "./itchyVM";


// export function move(context: ExecutionContext, steps: number) {
//     context.sprite!.x
// }


export function* motion_changexby(context: ExecutionContext, dx: number) {
    const sprite = context.sprite!;
    sprite.x += dx;
}

export function* motion_xposition(context: ExecutionContext) {
    return context.sprite!.x;
}

export function* operator_add(_: ExecutionContext, a: number, b: number) {
    return a + b;
}

export function* control_wait(_: ExecutionContext, seconds: number) {
    yield {
        type: "wait",
        seconds: Math.max(0, seconds)
    };
}