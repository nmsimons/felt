import { IMember, SharedMap } from 'fluid-framework';
import { SignalManager, SignalListener } from '@fluid-experimental/data-objects';
import { AzureMember, IAzureAudience } from '@fluidframework/azure-client';
import { SharedCounter } from '@fluidframework/counter/dist/counter';

import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { loadFluidData } from './fluid';
import { Color, getNextColor, getNextShape, Shape, getRandomInt } from './util';
import {
    Pixi2Fluid,
    FluidDisplayObject,
    Signals,
    Fluid2Pixi,
    Pixi2Signal,
    Signal2Pixi,
    SignalPackage,
} from './wrappers';
import * as UX from './ux';
import { Guid } from 'guid-typescript';

import './styles.scss';

// defines a custom map for storing local shapes that fires an event when the map changes
export class Shapes extends Map<string, FeltShape> {
    public onChanged?: () => void;

    constructor() {
        super();
    }

    public set(key: string, value: FeltShape): this {
        const o = super.set(key, value);
        if (this.onChanged !== undefined) {
            this.onChanged();
        }
        return o;
    }

    public delete(key: string): boolean {
        const b = super.delete(key);
        if (this.onChanged !== undefined) {
            this.onChanged();
        }
        return b;
    }

    public clear(): void {
        super.clear;
        if (this.onChanged !== undefined) {
            this.onChanged();
        }
    }
}

// set some constants for shapes
export const shapeLimit = 999;
export const size = 60;

async function main() {
    // Initialize Fluid
    const { container, services } = await loadFluidData();
    const audience = services.audience;

    // Define a custom map for storing selected objects that fires an event when it changes
    // and syncs with fluid data to show presence in other clients
    class Selection extends Shapes {
        constructor() {
            super();
        }

        public delete(key: string): boolean {
            const shape: FeltShape | undefined = this.get(key);
            const me: AzureMember | undefined = audience.getMyself();

            if (shape !== undefined) {
                shape.removeSelection();
                const users: string[] = getPresenceArray(shape.id);
                if (me !== undefined) {
                    removeUserFromPresenceArray({ arr: users, userId: me.userId });
                    fluidPresence.set(shape.id, users);
                    if (users.length === 0) fluidPresence.delete(shape.id);
                } else {
                    console.log('Failed to set presence!!!');
                }
            }
            return super.delete(key);
        }

        public set(key: string, value: FeltShape): this {
            value.showSelection();
            const users: string[] = getPresenceArray(value.id);
            const me: AzureMember | undefined = audience.getMyself();

            if (me != undefined) {
                flushPresenceArray(users);
                addUserToPresenceArray({ arr: users, userId: me.userId });
                fluidPresence.set(value.id, users);
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

    async function setSelected(dobj: FeltShape | undefined): Promise<void> {
        //Since we don't currently support multi select, clear the current selection
        selection.clear();

        if (dobj !== undefined && dobj.id !== undefined) {
            if (!selection.has(dobj.id)) {
                selection.set(dobj.id, dobj);
            }
        }
    }

    // create the root element for React
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // disable right-click context menu since right-click is reserved
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    // create a local map for shapes - contains customized PIXI objects
    const localShapes = new Shapes();

    // initialize signal manager
    const signaler = container.initialObjects.signalManager as SignalManager;

    // initialize the selection object (a custom map) which is used to manage local selection and is passed
    // to the React app for state and events
    const selection = new Selection();

    // fetches the array of users for a specific shape from the Shared Map used to track presence
    function getPresenceArray(shapeId: string): string[] {
        const users: string[] | undefined = fluidPresence.get(shapeId);
        if (users === undefined) {
            return [];
        } else {
            return users;
        }
    }

    // create PIXI app
    const pixiApp = await createPixiApp();

    // create Fluid map for shapes - contains only the data that needs to be
    // synched between clients
    const fluidShapes = container.initialObjects.shapes as SharedMap;

    // create Fluid map for presence
    const fluidPresence = container.initialObjects.presence as SharedMap;

    // create fluid counter for shared max z order
    const fluidMaxZIndex = container.initialObjects.maxZOrder as SharedCounter;

    // brings the shape to the top of the zorder and syncs with Fluid
    function bringToFront(shape: FeltShape): void {
        if (shape.zIndex < fluidMaxZIndex.value) {
            shape.zIndex = getMaxZIndex();
            shape.fluidSync();
        }
    }

    // increments the zorder by one and returns the value
    function getMaxZIndex(): number {
        fluidMaxZIndex.increment(1);
        return fluidMaxZIndex.value;
    }

    function bringSelectedToFront(): void {
        changeSelectedShapes((shape: FeltShape) => bringToFront(shape));
    }

    // flag to allow the app to switch between using ops and signals or just ops.
    let useSignals: boolean = true;

    // function to toggle the signals flag
    function toggleSignals(): void {
        useSignals = !useSignals;
    }

    // This function needs to be called each time a shape is changed.
    // It's passed in to the CreateShape function which wires it up to the
    // PIXI events for the shape. It is also called when a shape property is changed
    // Note: it shouldn't be called if a shape property is changed because of a change
    // in another client. Only if the change originates locally.
    function updateFluidData(dobj: FeltShape): void {
        // Store the position in Fluid
        if (dobj.dragging && useSignals) {
            const sig = Pixi2Signal(dobj);
            signaler.submitSignal(Signals.ON_DRAG, sig);
        } else {
            const fobj = Pixi2Fluid(dobj);
            fluidShapes.set(dobj.id, fobj);
        }
    }

    // Creates a new FeltShape object which is the local object that represents
    // all shapes on the canvas
    function addNewLocalShape(
        shape: Shape,
        color: Color,
        id: string,
        x: number,
        y: number,
        z: number
    ): FeltShape {
        const fs = new FeltShape(
            pixiApp!,
            shape,
            color,
            size,
            id,
            x,
            y,
            z,
            updateFluidData,
            setSelected // function that manages local selection
        );

        localShapes.set(id, fs); // add the new shape to local data
        pixiApp!.stage.addChild(fs); // add the new shape to the PIXI canvas

        return fs;
    }

    // adds a new shape
    function addNewShape(
        shape: Shape,
        color: Color,
        id: string,
        x: number,
        y: number,
        z: number,
        selectShape: boolean = true
    ): FeltShape {
        const fs = addNewLocalShape(shape, color, id, x, y, z);
        fs.fluidSync();
        if (selectShape) setSelected(fs);
        return fs;
    }

    // get the Fluid shapes that already exist
    fluidShapes.forEach((fdo: FluidDisplayObject, id: string) => {
        // add the Fluid shapes to the local shape data
        if (!fdo.deleted) {
            addNewLocalShape(fdo.shape, fdo.color, fdo.id, fdo.x, fdo.y, fdo.z);
        }
    });

    // function passed into React UX for creating shapes
    function createShape(shape: Shape, color: Color): void {
        if (localShapes.size < shapeLimit) {
            const fs = addNewShape(
                shape,
                color,
                Guid.create().toString(),
                size,
                size,
                getMaxZIndex()
            );
        }
    }

    // function passed into React UX for creating lots of different shapes at once
    function createLotsOfShapes(amount: number): void {
        let shape = Shape.Circle;
        let color = Color.Red;

        for (let index = 0; index < amount; index++) {
            shape = getNextShape(shape);
            color = getNextColor(color);

            if (localShapes.size < shapeLimit) {
                const fs = addNewShape(
                    shape,
                    color,
                    Guid.create().toString(),
                    getRandomInt(size, pixiApp.screen.width - size),
                    getRandomInt(size, pixiApp.screen.height - size),
                    getMaxZIndex(),
                    false
                );
            }
        }
    }

    // Function passed to React to change the color of selected shapes
    function changeColorofSelected(color: Color): void {
        changeSelectedShapes((shape: FeltShape) => changeColor(shape, color));
    }

    // Changes the color of a shape and syncs with the Fluid data
    // Note, the sync happens outside of the local object to allow clients
    // to apply remote changes without triggering more syncs
    function changeColor(shape: FeltShape, color: Color): void {
        shape.color = color;
        shape.fluidSync(); // sync color with Fluid
    }

    // A function that iterates over all selected shapes and calls the passed function
    // for each shape
    function changeSelectedShapes(f: Function): void {
        if (selection.size > 0) {
            selection.forEach((value: FeltShape | undefined, key: string) => {
                if (value !== undefined) {
                    f(value);
                } else {
                    selection.delete(key);
                }
            });
        }
    }

    // Function passed to React to delete selected shapes
    function deleteSelectedShapes(): void {
        changeSelectedShapes((shape: FeltShape) => deleteShape(shape));
    }

    function deleteAllShapes(): void {
        localShapes.forEach((value: FeltShape, key: string) => {
            deleteShape(value);
            console.log("delete " + key);
        })
    }

    function deleteShape(shape: FeltShape): void {
        // Set local flag to deleted
        shape.deleted = true;

        // Sync local shape with Fluid
        shape.fluidSync();

        // Remove shape from local map
        localShapes.delete(shape.id);

        // Remove shape from fluid presence map
        fluidPresence.delete(shape.id);

        // Remove the shape from the canvas
        selection.delete(shape.id);

        fluidShapes.delete(shape.id);

        // Destroy the local shape object (Note: the Fluid object still exists, is marked
        // deleted, and is garbage). TODO: Garbage collection
        shape.destroy();
    }

    // event handler for detecting remote changes to Fluid data and updating
    // the local data
    fluidShapes.on('valueChanged', (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject; // get the shape that changed from the shared map
            if (remoteShape === undefined) return;
            const localShape = localShapes.get(remoteShape.id); // get the local instance of that shape
            if (localShape !== undefined) {
                // check to see if the local shape exists
                if (remoteShape.deleted) {
                    selection.delete(localShape.id);
                    deleteShape(localShape);
                } else {
                    Fluid2Pixi(localShape, remoteShape); // sync up the properties of the local shape with the remote shape
                }
            } else {
                if (!remoteShape.deleted) {
                    const newLocalShape = addNewLocalShape(
                        // create the local shape as it didn't exist using the properties of the remote shape
                        remoteShape.shape,
                        remoteShape.color,
                        remoteShape.id,
                        remoteShape.x,
                        remoteShape.y,
                        remoteShape.z
                    );
                }
            }
        }
    });

    // When a shape is selected in a client it is added to a special SharedMap for showing presence - this event fires when that happens
    fluidPresence.on('valueChanged', (changed, local, target) => {
        if (target.has(changed.key)) {
            const remote = target.get(changed.key).slice();
            const me: AzureMember | undefined = audience.getMyself();

            if (me !== undefined) {
                const i: number = remote.indexOf(me.userId);
                if (i > -1) {
                    remote.splice(i, 1);
                }
            }

            if (localShapes.has(changed.key)) {
                if (remote.length > 0) {
                    localShapes.get(changed.key)!.showPresence();
                } else {
                    localShapes.get(changed.key)!.removePresence();
                }
            }
        }
    });

    // When a user leaves the session, remove all that users presence data from
    // the presence shared map. Note, all clients run this code right now
    audience.on('memberRemoved', (clientId: string, member: IMember) => {
        fluidPresence.forEach((value: string[], key: string) => {
            removeUserFromPresenceArray({ arr: value, userId: member.userId });
            fluidPresence.set(key, value);
        });
    });

    function removeUserFromPresenceArray({
        arr,
        userId,
    }: {
        arr: string[];
        userId: string;
    }): void {
        const i = arr.indexOf(userId);
        if (i > -1) {
            arr.splice(i, 1);
            removeUserFromPresenceArray({ arr, userId });
        }
    }

    function addUserToPresenceArray({
        arr,
        userId,
    }: {
        arr: string[];
        userId: string;
    }): void {
        if (arr.indexOf(userId) === -1) {
            arr.push(userId);
        }
    }

    // semi optimal tidy of the presence array to remove
    // stray data from previous sessions. This is currently run
    // fairly frequently but really only needs to run when a session is
    // started.
    function flushPresenceArray(arr: string[]): void {
        arr.forEach((value: string, index: number) => {
            if (!audience.getMembers().has(value)) {
                arr.splice(index, 1);
            }
        });
    }

    // When shapes are dragged, instead of updating the Fluid data, we send a Signal using fluid. This function will
    // handle the signal we send and update the local state accordingly.
    const signalHandler: SignalListener = (
        clientId: string,
        local: boolean,
        payload: SignalPackage
    ) => {
        if (!local) {
            const localShape = localShapes.get(payload.id);
            if (localShape) {
                Signal2Pixi(localShape, payload);
            }
        }
    };

    signaler.onSignal(Signals.ON_DRAG, signalHandler);

    // initialize the React UX
    ReactDOM.render(
        <UX.ReactApp
            audience={audience}
            createShape={createShape}
            createLotsOfShapes={createLotsOfShapes}
            changeColor={changeColorofSelected}
            deleteShape={deleteSelectedShapes}
            deleteAllShapes={deleteAllShapes}
            bringToFront={bringSelectedToFront}
            toggleSignals={toggleSignals}
            signals={() => {
                return useSignals;
            }}
            selectionManager={selection}
            localShapes={localShapes}
            fluidShapes={fluidShapes}
        />,
        document.getElementById('root')
    );

    // insert the PIXI canvas in the page
    document.getElementById('canvas')?.appendChild(pixiApp!.view);

    async function createPixiApp() {
        const pixiApp = await initPixiApp();

        pixiApp.stage.sortableChildren = true;

        // Create the scaled stage and then add stuff to it
        const scaledContainer = createScaledContainer(pixiApp);

        pixiApp.stage.removeChildren();

        pixiApp.stage.addChild(scaledContainer);

        // make background clickable
        addBackgroundShape(setSelected, pixiApp);
        return pixiApp;
    }
}

// initialize the PIXI app
async function initPixiApp() {
    PIXI.settings.RESOLUTION = window.devicePixelRatio || 1;

    // The PixiJS application instance
    const app = new PIXI.Application({
        width: 600,
        height: 600,
        autoDensity: true, // Handles high DPI screens
        backgroundColor: 0xffffff,
    });

    return app;
}

// Clear the stage and create a new scaled container; the
// provided callback will be called with the new container
const createScaledContainer = (app: PIXI.Application) => {
    // This is the stage for the new scene
    const container = new PIXI.Container();
    container.width = WIDTH;
    container.height = HEIGHT;
    container.scale.x = actualWidth(app) / WIDTH;
    container.scale.y = actualHeight(app) / HEIGHT;
    container.x = app.screen.width / 2 - actualWidth(app) / 2;
    container.y = app.screen.height / 2 - actualHeight(app) / 2;
    container.sortableChildren = true;

    return container;
};

const WIDTH: number = 500;

const HEIGHT: number = 500;

const actualWidth = (app: PIXI.Application) => {
    const { width, height } = app.screen;
    const isWidthConstrained = width < height;
    return isWidthConstrained ? width : height;
};

const actualHeight = (app: PIXI.Application) => {
    const { width, height } = app.screen;
    const isHeightConstrained = width > height;
    return isHeightConstrained ? height : width;
};

const addBackgroundShape = (
    manageSelection: (dobj: undefined) => void,
    app: PIXI.Application
) => {
    var bg: PIXI.Graphics = new PIXI.Graphics();
    bg.beginFill(0x000000);
    bg.drawRect(0, 0, app.screen.width, app.screen.height);
    bg.endFill();
    bg.interactive = true;

    app.stage.addChild(bg);

    bg.on('pointerup', manageSelection);
};

// wrapper class for a PIXI shape with a few extra methods and properties
// for creating and managing shapes
export class FeltShape extends PIXI.Graphics {
    id = '';
    dragging = false;
    deleted = false;
    private _color: Color = Color.Red;
    readonly shape: Shape = Shape.Circle;
    readonly size: number = 90;
    private _selectionFrame: PIXI.Graphics | undefined;
    private _presenceFrame: PIXI.Graphics | undefined;
    private _shape: PIXI.Graphics;
    public fluidSync: () => void;

    constructor(
        app: PIXI.Application,
        shape: Shape,
        color: Color,
        size: number,
        id: string,
        x: number,
        y: number,
        z: number,
        updateFluidData: (dobj: FeltShape) => void,
        setSelected: (dobj: FeltShape) => void
    ) {
        super();

        this.fluidSync = () => updateFluidData(this);

        this.id = id;
        this.shape = shape;
        this.size = size;
        this._shape = new PIXI.Graphics();
        this.addChild(this._shape);
        this._shape.beginFill(0xffffff);
        this.setShape();
        this._shape.endFill();
        this.color = color;
        this.interactive = true;
        this.buttonMode = true;
        this.x = x;
        this.y = y;
        this.zIndex = z;

        const onDragStart = (event: any) => {
            this.dragging = true;
            updateFluidData(this); // syncs local changes with Fluid data
        };

        const onDragEnd = (event: any) => {
            if (this.dragging) {
                this.dragging = false;
                updateFluidData(this); // syncs local changes with Fluid data
            }
        };

        const onDragMove = (event: any) => {
            if (this.dragging) {
                updatePosition(event.data.global.x, event.data.global.y);
                updateFluidData(this); // syncs local changes with Fluid data
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

    set color(color: Color) {
        this._color = color;
        this._shape.tint = Number(color);
    }

    get color() {
        return this._color;
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
        switch (this.shape) {
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

export default main();
