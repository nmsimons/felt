import { DisplayObject, Sprite, Graphics } from 'pixi.js';

export interface FluidDisplayObject {
    x: number;
    y: number;
    alpha: number;
}

export interface DragSignalPayload extends FluidDisplayObject {
    shapeId: string;
}

export enum Signals {
    'ON_DRAG' = 'ON_DRAG',
}

export const Pixi2Fluid = (
    dobj: DisplayObject | Sprite | Graphics
): FluidDisplayObject => {
    if (dobj instanceof Sprite || dobj instanceof Graphics) {
        return {
            x: dobj.x,
            y: dobj.y,
            alpha: dobj.alpha,
        };
    }

    console.warn(`Received a plain display object`);
    return {
        x: dobj.x,
        y: dobj.y,
        alpha: 1,
    };
};

export const Fluid2Pixi = (
    shapeToUpdate: DisplayObject | Sprite | Graphics,
    sourceObject: FluidDisplayObject
) => {
    shapeToUpdate.x = sourceObject.x;
    shapeToUpdate.y = sourceObject.y;
    shapeToUpdate.alpha = sourceObject.alpha;
    return shapeToUpdate;
};
