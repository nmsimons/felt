import * as PIXI from 'pixi.js';
import { Color, Shape } from './util';
import { AzureMember, IAzureAudience } from '@fluidframework/azure-client';
import { removeUserFromPresenceArray, addUserToPresenceArray, shouldShowPresence, userIsInPresenceArray } from "./presence";
import { Pixi2Signal, Signals } from "./wrappers";
import { Signaler } from "@fluid-experimental/data-objects";
import { SharedCounter } from "@fluidframework/counter";
import { IDirectory, IValueChanged, SharedDirectory, SharedMap } from "fluid-framework";

// set some constants for shapes
export const shapeLimit = 100;

// brings the shape to the top of the zorder
export const bringToFront = (feltShape: FeltShape, maxZ: SharedCounter): void => {
    if (feltShape.z < maxZ.value) {
        feltShape.z = getMaxZIndex(maxZ);
    }
}

// increments the zorder by one and returns the value
export const getMaxZIndex = (maxZ: SharedCounter): number => {
    maxZ.increment(1);
    return maxZ.value;
}

export const addShapeToShapeRootDirectory = (
    shape: Shape,
    color: Color,
    id: string,
    x: number,
    y: number,
    z: number,
    sharedDirectory: SharedDirectory): void => {

    const position = {
        x,
        y,
    };

    const properties = {
        id,
        shape,
    };

    const users: string[] = [];

    const shapeDirectory = sharedDirectory.createSubDirectory("shapes").createSubDirectory(id);
    shapeDirectory
        .set("position", position)
        .set("color", color)
        .set("z", z)
        .set("users", users)
        .set("properties", properties);
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
        super.clear();
        for (const cb of this._cbs) {
            cb();
        }
    }
}

// wrapper class for a PIXI shape with a few extra methods and properties
// for creating and managing shapes
export class FeltShape extends PIXI.Graphics {
    dragging = false;
    static readonly size: number = 60;
    private _selectionFrame: PIXI.Graphics | undefined;
    private _presenceFrame: PIXI.Graphics | undefined;
    private _shape: PIXI.Graphics;
    public id: string;

    public constructor(
        private app: PIXI.Application,
        public shapeDirectory: IDirectory,
        private clearPresence: (userId: string) => void,
        private addToSelected: (shape: FeltShape) => void,
        readonly audience: IAzureAudience,
        public useSignals: () => boolean,
        readonly signaler: Signaler
    ) {
        super();
        this.id = this.shapeDirectory.get("properties").id;
        this._shape = new PIXI.Graphics();
        this.initProperties();
        this.initPixiShape();
        this.initUserEvents();
        // this.initFluidEvents(); // not using this because it adds no value since we have to listen at the root anyway
    }

    private initFluidEvents = () => {
        this.shapeDirectory.on("containedValueChanged", (changed: IValueChanged, local: boolean, target: IDirectory) => {
            this.sync(changed.key);
        })
    }

    private initPixiShape = () => {
        this._shape.beginFill(0xffffff);
        this.setShape();
        this._shape.endFill();
        this.interactive = true;
        this.buttonMode = true;
        this.addChild(this._shape);
        this.app.stage.addChild(this);
    }

    private initProperties = () => {
        this.x = this.shapeDirectory.get("position").x;
        this.y = this.shapeDirectory.get("position").y;
        this._shape.tint = Number(this.color);
        this.zIndex = this.shapeDirectory.get("z") as number;
    }

    private initUserEvents = () => {
        const onDragStart = (event: any) => {
            this.dragging = true;
        };

        const onDragEnd = (event: any) => {
            if (this.dragging) {
                this.dragging = false;

                const pos = (x: number, y: number) => {return {x, y}};
                this.updateFluidLocation(pos(this.x, this.y)); // syncs local changes with Fluid data - note that this call uses the current position to fix a bug where the shape shifts on selection
            }
        };

        const onDragMove = (event: any) => {
            if (this.dragging) {
                this.updateFluidLocation(clampXY(event.data.global.x, event.data.global.y)); // syncs local changes with Fluid data
            }
        };

        const onSelect = (event: any) => {
            this.select();
        };

        const clampXY = (x: number, y: number): {x: number, y: number} => {

            if (this._shape === undefined) return {x, y};

            if (
                x < this._shape.width / 2 ||
                x > this.app.screen.width - this._shape.width / 2
            ) {
                x = this.x;
            }

            if (
                y < this._shape.height / 2 ||
                y > this.app.screen.height - this._shape.height / 2
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
    }

    set color(color: Color) {
        this.shapeDirectory.set("color", color);
    }

    get color() {
        return this.shapeDirectory.get("color") as Color;
    }

    set z(value: number) {
        this.shapeDirectory.set("z", value);
    }

    get z() {
        return this.shapeDirectory.get("z") as number;
    }

    private updateFluidLocation = (position: {x: number, y: number}) =>  {
        // Store the position in Fluid
        if (this.dragging && this.useSignals()) {
            const sig = Pixi2Signal(this);
            this.signaler.submitSignal(Signals.ON_DRAG, sig);
            this.x = position.x; this.y = position.y;
        } else {
            this.shapeDirectory.set("position", position);
        }
    }

    public sync(key: string) {

        console.log(key);

        switch (key) {
            case ("position"): {
                this.x = this.shapeDirectory.get("position").x;
                this.y = this.shapeDirectory.get("position").y;
                break;
            }
            case ("color"): {
                this._shape.tint = Number(this.color);
                break;
            }
            case ("z"): {
                this.zIndex = this.shapeDirectory.get("z") as number;
                break;
            }
            case ("properties"): {
                break;
            }
            case ("users"): {
                this.setPresence();
                break;
            }
        }
    }

    private setPresence() {
        const me: AzureMember | undefined = this.audience.getMyself();
        if (me !== undefined) {
            if (shouldShowPresence(this.shapeDirectory.get("users") as string[], me.userId)) {
                this.showPresence();
            } else {
                this.removePresence();
            }
        } else {
            this.removePresence();
        }
    }

    public unselect() {
        // no need to remove from the selection map as we don't support multi-select and we clear all on each selection
        this.removeSelection(); // removes the UI

        const me: AzureMember | undefined = this.audience.getMyself();
        if (me !== undefined) {
            removeUserFromPresenceArray(me.userId, this.shapeDirectory);
        } else {
            console.log('Failed to delete presence!!!');
        }
    }

    public select() {

        this.addToSelected(this); // this updates the local selection - even if presence isn't set, this is useful
        this.showSelection(); // this just shows the UI

        const me: AzureMember | undefined = this.audience.getMyself();
        if (me === undefined) { return }; // it must be very early or something is broken
        if ( userIsInPresenceArray(this.shapeDirectory.get("users") as string[], me.userId) ) { return } // this is already in the presence array so no need to add it again

        this.clearPresence(me.userId);
        if (me !== undefined) {
            addUserToPresenceArray(me.userId, this.shapeDirectory);
        } else {
            console.log('Failed to set presence!!!');
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
        const text = new PIXI.Text(this.shapeDirectory.get("users").length.toString(), style)
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
        switch (this.shapeDirectory.get("properties").shape as Shape) {
            case Shape.Circle:
                this._shape.drawCircle(0, 0, FeltShape.size / 2);
                break;
            case Shape.Square:
                this._shape.drawRect(
                    -FeltShape.size / 2,
                    -FeltShape.size / 2,
                    FeltShape.size,
                    FeltShape.size
                );
                break;
            case Shape.Triangle:
                // eslint-disable-next-line no-case-declarations
                const path = [
                    0,
                    -(FeltShape.size / 2),
                    -(FeltShape.size / 2),
                    FeltShape.size / 2,
                    FeltShape.size / 2,
                    FeltShape.size / 2,
                ];
                this._shape.drawPolygon(path);
                break;
            case Shape.Rectangle:
                this._shape.drawRect(
                    (-FeltShape.size * 1.5) / 2,
                    -FeltShape.size / 2,
                    FeltShape.size * 1.5,
                    FeltShape.size
                );
                break;
            default:
                this._shape.drawCircle(0, 0, FeltShape.size);
                break;
        }
    }
}