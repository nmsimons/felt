import { FeltShape } from '.';
import { Color, Shape } from './util';

export interface FluidDisplayObject {
    id: string;
    x: number;
    y: number;
    alpha: number;
    color: Color;
    z: number;
    shape: Shape;
    deleted: boolean;
}

export interface SignalPackage {
    id: string;
    x: number;
    y: number;
}

export const Signals = {
    ON_DRAG: 'ON_DRAG',
} as const;

export const Pixi2Fluid = (dobj: FeltShape): FluidDisplayObject => {
    return {
        id: dobj.id,
        x: dobj.x,
        y: dobj.y,
        alpha: dobj.alpha,
        color: dobj.color,
        z: dobj.zIndex,
        shape: dobj.shape,
        deleted: dobj.deleted
    };
};

export const Pixi2Signal = (dobj: FeltShape): SignalPackage => {
    return {
        id: dobj.id,
        x: dobj.x,
        y: dobj.y
    }
}

export const Fluid2Pixi = (
    shapeToUpdate: FeltShape,
    sourceObject: FluidDisplayObject
) => {
    shapeToUpdate.x = sourceObject.x;
    shapeToUpdate.y = sourceObject.y;
    shapeToUpdate.alpha = sourceObject.alpha;
    shapeToUpdate.zIndex = sourceObject.z;
    shapeToUpdate.color = sourceObject.color;
    shapeToUpdate.deleted = sourceObject.deleted;
    return shapeToUpdate;
};

export const Signal2Pixi = (
    shapeToUpdate: FeltShape,
    sourceObject: SignalPackage
) => {
    shapeToUpdate.x = sourceObject.x;
    shapeToUpdate.y = sourceObject.y;
    return shapeToUpdate;
}
