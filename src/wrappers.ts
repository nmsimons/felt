import { DisplayObject, Sprite } from 'pixi.js';

export interface FluidDisplayObject {
    // width: number;
    // height: number;
    x: number;
    y: number;
    alpha: number;
}

export const DisplayObject2Fluid = (dobj: DisplayObject | Sprite): FluidDisplayObject => {
    if (dobj instanceof Sprite) {
        return {
            x: dobj.x,
            y: dobj.y,
            alpha: dobj.alpha,
        }
    }

    // if (dobj instanceof DisplayObject) {
    console.warn(`display object`);
    return {
        x: dobj.x,
        y: dobj.y,
        alpha: 1,
    }
    // }
};
