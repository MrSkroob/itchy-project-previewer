import { ExecutionContext } from "./itchyVM";


// export function move(context: ExecutionContext, steps: number) {
//     context.sprite!.x
// }


export function changeX(context: ExecutionContext, dX: number) {
    context.sprite!.x += dX;
}


export function changeY(context: ExecutionContext, dY: number) {
    context.sprite!.y += dY;
}