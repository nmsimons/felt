import { LocationProxy, ShapeProxy } from "./schema";
import * as PIXI from 'pixi.js';
import { Color, getNextColor, getNextShape, Shape, getRandomInt } from './util';
import { AzureMember, IAzureAudience } from '@fluidframework/azure-client';
import { EditableField } from "@fluid-internal/tree";

// set some constants for shapes
export const shapeLimit = 100;
export const size = 60;

export function addShapeToShapeTree(
    shape: Shape,
    color: Color,
    id: string,
    x: number,
    y: number,
    z: number,
    shapeTree: ShapeProxy[] & EditableField): void {

    const locationProxy = {
        x: x,
        y: y,
    } as LocationProxy;

    const shapeProxy = {
        id: id,
        location: locationProxy,
        color: color,
        z: z,
        shape: shape,
        deleted: false,
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

// Define a custom map for storing selected objects that fires an event when it changes
// and syncs with fluid data to show presence in other clients
export class Selection extends Shapes {
    constructor(max: number,
        private audience: IAzureAudience,
        private addToPresence: ({
        shapeId,
        userId,
        localShapes
    }: {
        shapeId: string;
        userId: string;
        localShapes: Shapes;
    }) => void,
    private removeFromPresence: ({
        shapeId,
        userId,
        localShapes
    }: {
        shapeId: string;
        userId: string;
        localShapes: Shapes;
    }) => void,
        private localShapes: Shapes) {
        super(max);
    }

    public delete(key: string): boolean {
        const shape: FeltShape | undefined = this.get(key);
        const me: AzureMember | undefined = this.audience.getMyself();

        if (shape !== undefined) {
            shape.removeSelection();
            if (me !== undefined) {
                this.removeFromPresence({ shapeId: shape.id, userId: me.userId, localShapes: this.localShapes });
            } else {
                console.log('Failed to delete presence!!!');
            }

        }
        return super.delete(key);
    }

    public set(key: string, value: FeltShape): this {
        value.showSelection();
        const me: AzureMember | undefined = this.audience.getMyself();

        if (me !== undefined) {
            //flushPresenceArray(users); // currently noop
            this.addToPresence({ shapeId: value.id, userId: me.userId, localShapes: this.localShapes });
        } else {
            console.log('Failed to set presence!!!');
        }
        return super.set(key, value);
    }

    public clear(): void {
        this.forEach(async (value: FeltShape | undefined, key: string) => {
            this.delete(key);
        });

        super.clear();
    }

    public get selected() {
        return this.size > 0;
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

    constructor(
        app: PIXI.Application,
        public shapeProxy: ShapeProxy, // TODO this should be readonly
        updateShapeLocation: (feltShape: FeltShape) => void,
        setSelected: (feltShape: FeltShape) => void
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

        this._shape.tint = Number(this.color);
        this.x = this.shapeProxy.location.x;
        this.y = this.shapeProxy.location.y;
        this.zIndex = this.shapeProxy.z;

        const onDragStart = (event: any) => {
            this.dragging = true;
            updateShapeLocation(this); // syncs local changes with Fluid data
        };

        const onDragEnd = (event: any) => {
            if (this.dragging) {
                this.dragging = false;
                updateShapeLocation(this); // syncs local changes with Fluid data
            }
        };

        const onDragMove = (event: any) => {
            if (this.dragging) {
                updatePosition(event.data.global.x, event.data.global.y);
                updateShapeLocation(this); // syncs local changes with Fluid data
            }
        };

        const onSelect = (event: any) => {
            setSelected(this);
        };

        // sets local postion and enforces canvas boundary
        const updatePosition = (x: number, y: number) => {
            if (
                x >= this._shape.width / 2 &&
                x <= app.screen.width - this._shape.width / 2
            ) {
                this.x = x;
            }

            if (
                y >= this._shape.height / 2 &&
                y <= app.screen.height - this._shape.height / 2
            ) {
                this.y = y;
            }
        };

        // intialize event handlers
        this.on('pointerdown', onDragStart)
            .on('pointerup', onDragEnd)
            .on('pointerdown', onSelect)
            .on('pointerupoutside', onDragEnd)
            .on('pointermove', onDragMove);
    }

    get id() {
        return this.shapeProxy.id;
    }

    set color(color: Color) {
        this.shapeProxy.color = color;
    }

    get color() {
        return this.shapeProxy.color as Color;
    }

    set deleted(value: boolean) {
        this.shapeProxy.deleted = value;
    }

    get deleted() {
        return this.shapeProxy.deleted;
    }

    public sync() {
        this.x = this.shapeProxy.location.x;
        this.y = this.shapeProxy.location.y;
        this.zIndex = this.shapeProxy.z;
        this._shape.tint = Number(this.color);
    }

    public showSelection() {
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

    public removeSelection() {
        this._selectionFrame?.clear();
    }

    public showPresence() {
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
    }

    public removePresence() {
        this._presenceFrame?.clear();
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