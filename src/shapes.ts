import { PositionProxy, ShapeProxy } from "./schema";
import * as PIXI from 'pixi.js';
import { Color, Shape } from './util';
import { AzureMember, IAzureAudience } from '@fluidframework/azure-client';
import { EditableField, EditableTree } from "@fluid-internal/tree";
import { removeUserFromPresenceArray, addUserToPresenceArray, shouldShowPresence, userIsInPresenceArray, clearPresence } from "./presence";
import { Pixi2Signal, Signals } from "./wrappers";
import { Signaler } from "@fluid-experimental/data-objects";
import { SharedCounter } from "@fluidframework/counter";

// set some constants for shapes
export const shapeLimit = 100;
export const size = 60;

// brings the shape to the top of the zorder
export function bringToFront(feltShape: FeltShape, maxZ: SharedCounter): void {
    if (feltShape.z < maxZ.value) {
        feltShape.z = getMaxZIndex(maxZ);
    }
}

// increments the zorder by one and returns the value
export function getMaxZIndex(maxZ: SharedCounter): number {
    maxZ.increment(1);
    return maxZ.value;
}

export function addShapeToShapeTree(
    shape: Shape,
    color: Color,
    id: string,
    x: number,
    y: number,
    z: number,
    shapeTree: ShapeProxy[] & EditableField): void {

    const position = {
        x,
        y,
    } as PositionProxy;

    const shapeProxy = {
        id,
        position,
        color,
        z,
        shape,
    } as ShapeProxy;

    shapeTree[shapeTree.length] = shapeProxy;
}

// defines a custom map for storing local shapes that fires an event when the map changes
export class Shapes extends Map<string, FeltShape> {
    private _cbs: Array<() => void> = [];

    public onChanged(cb: () => void) {
        this._cbs.push(cb);
    }

    private _max: number;

    constructor(recommendedMax: number) {
        super();
        this._max = recommendedMax;
    }

    public get maxReached(): boolean {
        return this.size >= this._max;
    }

    public set(key: string, value: FeltShape): this {
        super.set(key, value);
        for (const cb of this._cbs) {
            cb();
        }
        return this;
    }

    public delete(key: string): boolean {
        const b = super.delete(key);
        for (const cb of this._cbs) {
            cb();
        }
        return b;
    }

    public clear(): void {
        super.clear;
        for (const cb of this._cbs) {
            cb();
        }
    }
}

// wrapper class for a PIXI shape with a few extra methods and properties
// for creating and managing shapes
export class FeltShape extends PIXI.Graphics {
    dragging = false;
    readonly size: number = 90;
    private _selectionFrame: PIXI.Graphics | undefined;
    private _presenceFrame: PIXI.Graphics | undefined;
    private _shape: PIXI.Graphics;
    private _id: string;

    constructor(
        app: PIXI.Application,
        public shapeProxy: ShapeProxy, // TODO this should be readonly
        clearSelected: (userId: string) => void,
        readonly audience: IAzureAudience,
        public useSignals: () => boolean,
        readonly signaler: Signaler
    ) {
        super();

        this.size = size;
        this._shape = new PIXI.Graphics();
        this.addChild(this._shape);
        this._shape.beginFill(0xffffff);
        this.setShape();
        this._shape.endFill();
        this.interactive = true;
        this.buttonMode = true;
        this._id = shapeProxy.id;

        this._shape.tint = Number(this.color);
        this.x = this.shapeProxy.position.x;
        this.y = this.shapeProxy.position.y;
        this.zIndex = this.z;

        const onDragStart = (event: any) => {
            this.dragging = true;
            this.updateFluidLocation(clampXY(event.data.global.x, event.data.global.y)); // syncs local changes with Fluid data
        };

        const onDragEnd = (event: any) => {
            if (this.dragging) {
                this.dragging = false;
                this.updateFluidLocation(clampXY(event.data.global.x, event.data.global.y)); // syncs local changes with Fluid data
            }
        };

        const onDragMove = (event: any) => {
            if (this.dragging) {
                //updatePosition(event.data.global.x, event.data.global.y);
                this.updateFluidLocation(clampXY(event.data.global.x, event.data.global.y)); // syncs local changes with Fluid data
            }
        };

        const onSelect = (event: any) => {
            const me: AzureMember | undefined = this.audience?.getMyself();
            if (me !== undefined) {
                clearSelected(me.userId);
                this.select();
            }
        };

        const clampXY = (x: number, y: number): {x: number, y: number} => {
            if (
                x < this._shape.width / 2 ||
                x > app.screen.width - this._shape.width / 2
            ) {
                x = this.x;
            }

            if (
                y < this._shape.height / 2 ||
                y > app.screen.height - this._shape.height / 2
            ) {
                y = this.y;
            }
            return {x, y}
        }

        // intialize event handlers
        this.on('pointerdown', onDragStart)
            .on('pointerup', onDragEnd)
            .on('pointerdown', onSelect)
            .on('pointerupoutside', onDragEnd)
            .on('pointermove', onDragMove);

        app.stage.addChild(this);
    }

    get id() {
        return this._id;
    }

    set color(color: Color) {
        this.shapeProxy.color = color;
    }

    get color() {
        return this.shapeProxy.color as Color;
    }

    set z(value: number) {
        this.shapeProxy.z = value;
    }

    get z() {
        return this.shapeProxy.z;
    }

    private updateFluidLocation = (position: {x: number, y: number}) =>  {
        // Store the position in Fluid
        if (this.dragging && this.useSignals()) {
            const sig = Pixi2Signal(this);
            this.signaler.submitSignal(Signals.ON_DRAG, sig);
            this.x = position.x; this.y = position.y;
        } else {
            this.shapeProxy.position = position as PositionProxy;
        }
    }

    public sync() {
        this.x = this.shapeProxy.position.x;
        this.y = this.shapeProxy.position.y;
        this.zIndex = this.z;
        this._shape.tint = Number(this.color);

        const me: AzureMember | undefined = this.audience.getMyself();
        if (me !== undefined) {
            if (shouldShowPresence(this.shapeProxy, me.userId)) {
                this.showPresence();
            } else {
                this.removePresence();
            }
        }

        this.selected ? this.showSelection() : this.removeSelection();
    }

    public unselect() {
        const me: AzureMember | undefined = this.audience?.getMyself();
        if (me !== undefined) {
            removeUserFromPresenceArray({ userId: me.userId, shapeProxy: this.shapeProxy });
        } else {
            console.log('Failed to delete presence!!!');
        }
    }

    public select() {
        const me: AzureMember | undefined = this.audience.getMyself();
        if (me !== undefined) {
            addUserToPresenceArray({ userId: me.userId, shapeProxy: this.shapeProxy });
        } else {
            console.log('Failed to set presence!!!');
        }
    }

    get selected() {
        const me: AzureMember | undefined = this.audience.getMyself();
        if (me !== undefined) {
            return userIsInPresenceArray(this.shapeProxy, me.userId);
        } else {
            return false;
        }
    }

    private showSelection() {
        if (!this._selectionFrame) {
            this._selectionFrame = new PIXI.Graphics();
            this.addChild(this._selectionFrame);
        }

        this._selectionFrame.clear();

        const handleSize = 16;
        const biteSize = 4;
        const color = 0xffffff;
        const left = -this._shape.width / 2 - handleSize / 2;
        const top = -this._shape.height / 2 - handleSize / 2;
        const right = this._shape.width / 2 - handleSize / 2;
        const bottom = this._shape.height / 2 - handleSize / 2;

        this._selectionFrame.zIndex = 5;

        this.drawFrame(
            this._selectionFrame,
            handleSize,
            biteSize,
            color,
            left,
            top,
            right,
            bottom
        );
    }

    private removeSelection() {
        this._selectionFrame?.clear();
    }

    private showPresence() {
        if (!this._presenceFrame) {
            this._presenceFrame = new PIXI.Graphics();
            this.addChild(this._presenceFrame);
        }

        this._presenceFrame.clear();

        const handleSize = 10;
        const biteSize = 4;
        const color = 0xaaaaaa;
        const left = -this._shape.width / 2 - handleSize / 2;
        const top = -this._shape.height / 2 - handleSize / 2;
        const right = this._shape.width / 2 - handleSize / 2;
        const bottom = this._shape.height / 2 - handleSize / 2;

        this._presenceFrame.zIndex = 4;

        this.drawFrame(
            this._presenceFrame,
            handleSize,
            biteSize,
            color,
            left,
            top,
            right,
            bottom
        );

        const style = new PIXI.TextStyle({
            align: "center",
            fill: "white",
            fontFamily: "Comic Sans MS",
            fontSize: 30,
            textBaseline: "bottom"
        });
        const text = new PIXI.Text(this.shapeProxy.users.length.toString(), style)
        text.x = top + 15;
        text.y = left + 15;
        this._presenceFrame.removeChildren()
        this._presenceFrame.addChild(text);
    }

    private removePresence() {
        this._presenceFrame?.clear().removeChildren();
    }

    private drawFrame(
        frame: PIXI.Graphics,
        handleSize: number,
        biteSize: number,
        color: number,
        left: number,
        top: number,
        right: number,
        bottom: number
    ) {
        frame.beginFill(color);
        frame.drawRect(left, top, handleSize, handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(
            left + biteSize,
            top + biteSize,
            handleSize - biteSize,
            handleSize - biteSize
        );
        frame.endHole();

        frame.beginFill(color);
        frame.drawRect(left, bottom, handleSize, handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(
            left + biteSize,
            bottom,
            handleSize - biteSize,
            handleSize - biteSize
        );
        frame.endHole();

        frame.beginFill(color);
        frame.drawRect(right, top, handleSize, handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(
            right,
            top + biteSize,
            handleSize - biteSize,
            handleSize - biteSize
        );
        frame.endHole();

        frame.beginFill(color);
        frame.drawRect(right, bottom, handleSize, handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(right, bottom, handleSize - biteSize, handleSize - biteSize);
        frame.endHole();
    }

    private setShape() {
        switch (this.shapeProxy.shape as Shape) {
            case Shape.Circle:
                this._shape.drawCircle(0, 0, this.size / 2);
                break;
            case Shape.Square:
                this._shape.drawRect(
                    -this.size / 2,
                    -this.size / 2,
                    this.size,
                    this.size
                );
                break;
            case Shape.Triangle:
                // eslint-disable-next-line no-case-declarations
                const path = [
                    0,
                    -(this.size / 2),
                    -(this.size / 2),
                    this.size / 2,
                    this.size / 2,
                    this.size / 2,
                ];
                this._shape.drawPolygon(path);
                break;
            case Shape.Rectangle:
                this._shape.drawRect(
                    (-this.size * 1.5) / 2,
                    -this.size / 2,
                    this.size * 1.5,
                    this.size
                );
                break;
            default:
                this._shape.drawCircle(0, 0, this.size);
                break;
        }
    }
}