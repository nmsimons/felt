import { DisplayObject } from 'pixi.js';

export interface FluidDisplayObject {
    // width: number;
    // height: number;
    x: number;
    y: number;
}

export const DisplayObject2Fluid = (dobj: DisplayObject): FluidDisplayObject => {
    return {
        x: dobj.x,
        y: dobj.y,
    }
};
