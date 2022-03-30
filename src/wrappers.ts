import { DisplayObject, Sprite, Graphics } from 'pixi.js';
import { getRandomColor } from './util';

export interface FluidDisplayObject {
    x: number;
    y: number;
    alpha: number;
    color: number;
    z: number;
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
            color: dobj.tint,
            z: dobj.zIndex,
        };
    }

    console.warn(`Received a plain display object`);
    return {
        x: dobj.x,
        y: dobj.y,
        alpha: 1,
        color: Number(getRandomColor()),
        z: dobj.zIndex,
    };
};

export const Fluid2Pixi = (
    shapeToUpdate: DisplayObject | Sprite | Graphics,
    sourceObject: FluidDisplayObject
) => {
    shapeToUpdate.x = sourceObject.x;
    shapeToUpdate.y = sourceObject.y;
    shapeToUpdate.alpha = sourceObject.alpha;
    shapeToUpdate.zIndex = sourceObject.z;

    if (shapeToUpdate instanceof Sprite || shapeToUpdate instanceof Graphics) {
        shapeToUpdate.tint = sourceObject.color;
    }

    return shapeToUpdate;
};

// export enum Color {
//     Red = 0xFF0000,
//     Green = 0x00FF00,
//     Blue = 0x0000FF,
//     Orange = 0xFF7F00,
//     Purple = 0x800080,
//     Random = 0xFFFFFF
// }
