import { DisplayObject, Sprite, Graphics } from 'pixi.js';
import { FeltShape } from '.';
import { getDeterministicColor, getNextColor } from './util';

export interface FluidDisplayObject {
    id: string;
    x: number;
    y: number;
    alpha: number;
    color: number;
    z: number;
    dragging: boolean,
}

export const Signals = {
    ON_DRAG: 'ON_DRAG',
} as const;

export const Pixi2Fluid = (
    dobj: FeltShape
): FluidDisplayObject => {
    return {
        id: dobj.id,
        x: dobj.x,
        y: dobj.y,
        alpha: dobj.alpha,
        color: dobj.tint,
        z: dobj.zIndex,
        dragging: dobj.dragging,
    };
};

export const Fluid2Pixi = (
    shapeToUpdate: FeltShape,
    sourceObject: FluidDisplayObject
) => {
    shapeToUpdate.x = sourceObject.x;
    shapeToUpdate.y = sourceObject.y;
    shapeToUpdate.alpha = sourceObject.alpha;
    shapeToUpdate.zIndex = sourceObject.z;
    shapeToUpdate.tint = sourceObject.color;
    shapeToUpdate.dragging = sourceObject.dragging;

    if (shapeToUpdate.dragging) {
        shapeToUpdate.frames++;
    } else {
        shapeToUpdate.frames = 0;
    }

    if (shapeToUpdate.signals) {
        console.log("remote frames (signals):" + shapeToUpdate.frames);
    } else {
        console.log("remote frames (ops):" + shapeToUpdate.frames);
    }

    return shapeToUpdate;
};