import { IMember } from 'fluid-framework';
import { Signaler, SignalListener } from '@fluid-experimental/data-objects';
import { AzureMember, IAzureAudience } from '@fluidframework/azure-client';
import { SharedCounter } from '@fluidframework/counter/dist/counter';
import { ISharedTree } from "@fluid-internal/tree";
import { EditableField } from "@fluid-internal/tree/dist/feature-libraries";

import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';

import { loadFluidData } from './fluid';
import { Color, getNextColor, getNextShape, Shape, getRandomInt } from './util';
import {
    Signals,
    Pixi2Signal,
    Signal2Pixi,
    SignalPackage,
} from './wrappers';
import * as UX from './ux';
import { Shapes, Selection, FeltShape, shapeLimit, size, addShapeToShapeTree } from './shapes';
import { appSchemaData, LocationProxy, ShapeProxy } from "./schema";
import { addUserToPresenceArray, removeUserFromPresenceArray, flushPresenceArray, shouldShowPresence } from "./presence"

import { Guid } from 'guid-typescript';

import './styles.scss';

async function main() {
    let disconnect: number = 0;
    let dirty: number = 0;

    console.log(performance.now() + ": BOOT")

    // Initialize Fluid
    const { container, services } = await loadFluidData();
    const audience = services.audience;

    container.on("connected", () => {
        console.log("CONNECTED after " + (performance.now() - disconnect) + " milliseconds.");
    })

    container.on("disconnected", () => {
        disconnect = performance.now();
        console.log("DISCONNECTED");
    })

    container.on("saved", () => {
        console.log("SAVED after " + (performance.now() - dirty) + " milliseconds.");
    })

    container.on("dirty", () => {
        dirty = performance.now();
        console.log("DIRTY");
    })

    async function setSelected(feltShape: FeltShape | undefined): Promise<void> {
        //Since we don't currently support multi select, clear the current selection
        selection.clear();

        if (feltShape !== undefined && feltShape.id !== undefined) {
            if (!selection.has(feltShape.id)) {
                selection.set(feltShape.id, feltShape);
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
    const localShapes = new Shapes(shapeLimit);

    // initialize signal manager
    const signaler = container.initialObjects.signalManager as Signaler;

    // initialize the selection object (a custom map) which is used to manage local selection and is passed
    // to the React app for state and events
    const selection = new Selection(shapeLimit, audience, addUserToPresenceArray, removeUserFromPresenceArray, localShapes);

    // create PIXI app
    const pixiApp = await createPixiApp();

    // create Fluid tree for shapes
    const fluidTree = container.initialObjects.tree as ISharedTree;
    fluidTree.storedSchema.update(appSchemaData);
    const shapeTree = fluidTree.root as ShapeProxy[] & EditableField;

    // create fluid counter for shared max z order
    const fluidMaxZIndex = container.initialObjects.maxZOrder as SharedCounter;

    // brings the shape to the top of the zorder and syncs with Fluid
    function bringToFront(feltShape: FeltShape): void {
        if (feltShape.zIndex < fluidMaxZIndex.value) {
            feltShape.zIndex = getMaxZIndex();
            feltShape.shapeProxy.z = feltShape.zIndex;
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

    // This function needs to be called each time a local shape is moved.
    // It's passed in to the CreateShape function which wires it up to the
    // PIXI events for the shape.
    function updateShapeLocation(feltShape: FeltShape): void {
        // Store the position in Fluid
        if (feltShape.dragging && useSignals) {
            const sig = Pixi2Signal(feltShape);
            signaler.submitSignal(Signals.ON_DRAG, sig);
        } else {
            feltShape.shapeProxy.location = {x: feltShape.x, y: feltShape.y} as LocationProxy;
        }
    }

    // Creates a new FeltShape object which is the local object that represents
    // all shapes on the canvas
    function addNewLocalShape(
        shapeProxy: ShapeProxy
    ): FeltShape {
        const feltShape = new FeltShape(
            pixiApp!,
            shapeProxy,
            updateShapeLocation,
            setSelected // function that manages local selection
        );

        localShapes.set(shapeProxy.id, feltShape); // add the new shape to local data
        pixiApp!.stage.addChild(feltShape); // add the new shape to the PIXI canvas

        return feltShape;
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
    ): void {
        addShapeToShapeTree(shape, color, id, x, y, z, shapeTree);
    }

    //Get all existing shapes
    for (let i = 0; i < shapeTree.length; i++) {
        const shapeProxy = shapeTree[i];
        if (!shapeProxy.deleted) {
            addNewLocalShape(shapeProxy);
        }
        updateAllShapes();
    }

    // function passed into React UX for creating shapes
    function createShape(shape: Shape, color: Color): void {
        if (localShapes.maxReached) return

        const fs = addNewShape(
            shape,
            color,
            Guid.create().toString(),
            size,
            size,
            getMaxZIndex()
        );
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
        })
        shapeTree.deleteNodes(0, shapeTree.length - 1);
    }

    function deleteShape(shape: FeltShape): void {
        // Set local flag to deleted
        shape.deleted = true;
    }

    function deleteLocalShape(shape: FeltShape): void {
        // Remove shape from local map
        localShapes.delete(shape.id);

        // Remove the shape from the canvas
        selection.delete(shape.id);

        // Destroy the local shape object (Note: the Fluid object still exists, is marked
        // deleted, and is garbage). TODO: Garbage collection
        shape.destroy();
    }

    // event handler for detecting remote changes to Fluid data and updating
    // the local data
    fluidTree.forest.on('afterDelta', (delta) => {
        updateAllShapes();
    })

    function updateAllShapes() {
        const me: AzureMember | undefined = audience.getMyself();

        for (let i = 0; i < shapeTree.length; i++) {
            const shapeProxy = shapeTree[i];

            const localShape = localShapes.get(shapeProxy.id);

            if (localShape != undefined) {
                localShape.shapeProxy = shapeProxy; // TODO this should not be necessary
                if (shapeProxy.deleted) {
                    deleteLocalShape(localShapes.get(shapeProxy.id)!);
                } else {
                    localShape.sync();

                    if (shouldShowPresence(shapeProxy, me?.userId)) {
                        localShape.showPresence();
                    } else {
                        localShape.removePresence();
                    }
                }
            } else if (!shapeProxy.deleted) {
                addNewLocalShape(shapeProxy);
            }
        }
    }

    // When a user leaves the session, remove all that users presence data from
    // the presence shared map. Note, all clients run this code right now
    audience.on('memberRemoved', (clientId: string, member: IMember) => {
        for (let i = 0; i < shapeTree.length; i++) {
            const shapeProxy = shapeTree[i];
            removeUserFromPresenceArray({shapeId: shapeProxy.id, userId: member.userId, localShapes: localShapes});
        }
    });

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
            shapeTree={shapeTree}
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

export default main();
