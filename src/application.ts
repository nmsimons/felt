/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Signaler, SignalListener } from '@fluid-experimental/data-objects';
import {
    AllowedUpdateType,
    ISharedTree,
    parentField,
} from '@fluid-experimental/tree2';
import { IAzureAudience } from '@fluidframework/azure-client';
import { SharedCounter } from '@fluidframework/counter';
import { Guid } from 'guid-typescript';
import { schema, Felt, Shape } from './schema';
import {
    FeltShape,
    addShapeToShapeTree,
    getMaxZIndex,
    shapeLimit,
    bringToFront,
    Shapes,
} from './shapes';
import { Color, getNextColor, getNextShape, getRandomInt, ShapeType } from './util';
import { clearPresence, removeUserFromPresenceArray } from './presence';
import * as PIXI from 'pixi.js';
import { loadFluidData } from './fluid';
import { ConnectionState, FluidContainer, IMember } from 'fluid-framework';
import { Signal2Pixi, SignalPackage, Signals } from './wrappers';
import { resolve } from 'path';

export class Application {
    private disconnect = 0;
    private dirty = 0;

    private constructor(
        public pixiApp: PIXI.Application,
        public selection: Shapes,
        public audience: IAzureAudience,
        public useSignals: boolean,
        public signaler: Signaler,
        public localShapes: Shapes,
        public shapeTree: Felt,
        public maxZ: SharedCounter,
        public container: FluidContainer,
        public fluidTree: ISharedTree
    ) {
        // make background clickable
        Application.addBackgroundShape(() => {
            this.clearSelection();
            clearPresence(audience.getMyself()?.userId!, shapeTree);
        }, pixiApp);

        container.on('connected', () => {
            console.log(
                'CONNECTED after ' +
                    (performance.now() - this.disconnect) +
                    ' milliseconds.'
            );
        });

        container.on('disconnected', () => {
            this.disconnect = performance.now();
            console.log('DISCONNECTED');
        });

        container.on('saved', () => {
            //console.log("SAVED after " + (performance.now() - dirty) + " milliseconds.");
        });

        container.on('dirty', () => {
            this.dirty = performance.now();
            //console.log("DIRTY");
        });

        //Get all existing shapes
        this.updateAllShapes();

        // event handler for detecting remote changes to Fluid data and updating
        // the local data
        fluidTree.events.on('afterBatch', () => {
            this.updateAllShapes();
        });

        // When a user leaves the session, remove all that users presence data from
        // the presence shared map. Note, all clients run this code right now
        audience.on('memberRemoved', (clientId: string, member: IMember) => {
            console.log(member.userId, 'JUST LEFT');
            for (const shape of shapeTree.shapes) {
                removeUserFromPresenceArray({ userId: member.userId, shape });
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
    }

    public static async build(): Promise<Application> {
        // Initialize Fluid
        const { container, services } = await loadFluidData();
        const audience = services.audience;

        // initialize signal manager
        const signaler = container.initialObjects.signalManager as Signaler;

        // create a local map for shapes - contains customized PIXI objects
        const localShapes = new Shapes(shapeLimit);

        // initialize the selection object (a custom map) which is used to manage local selection and is passed
        // to the React app for state and events
        const selection = new Shapes(shapeLimit);

        // create Fluid tree for shapes

        const schemaPolicy = {
            allowedSchemaModifications: AllowedUpdateType.None,
            initialTree: { shapes: [] },
            schema: schema,
        };

        const fluidTree = container.initialObjects.tree as ISharedTree;
        // TODO: find a way to either await trailing ops or support better merge resolution for schematize operations
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
        const treeView = fluidTree.schematize(schemaPolicy);
        const shapeTree = treeView.root as unknown as Felt;

        // create fluid counter for shared max z order
        const maxZ = container.initialObjects.maxZOrder as SharedCounter;

        // create PIXI app
        const pixiApp = await this.createPixiApp();

        return new Application(
            pixiApp,
            selection,
            audience,
            true,
            signaler,
            localShapes,
            shapeTree,
            maxZ,
            container,
            fluidTree
        );
    }

    private static async createPixiApp() {
        const pixiApp = await Application.initPixiApp();

        pixiApp.stage.sortableChildren = true;

        // Create the scaled stage and then add stuff to it
        const scaledContainer = Application.createScaledContainer(pixiApp);

        pixiApp.stage.removeChildren();

        pixiApp.stage.addChild(scaledContainer);

        return pixiApp;
    }

    // initialize the PIXI app
    private static async initPixiApp() {
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
    private static createScaledContainer = (app: PIXI.Application) => {
        // This is the stage for the new scene
        const container = new PIXI.Container();
        container.width = Application.WIDTH;
        container.height = Application.HEIGHT;
        container.scale.x = Application.actualWidth(app) / Application.WIDTH;
        container.scale.y = Application.actualHeight(app) / Application.HEIGHT;
        container.x = app.screen.width / 2 - Application.actualWidth(app) / 2;
        container.y = app.screen.height / 2 - Application.actualHeight(app) / 2;
        container.sortableChildren = true;

        return container;
    };

    private static WIDTH = 500;

    private static HEIGHT = 500;

    private static actualWidth = (app: PIXI.Application) => {
        const { width, height } = app.screen;
        const isWidthConstrained = width < height;
        return isWidthConstrained ? width : height;
    };

    private static actualHeight = (app: PIXI.Application) => {
        const { width, height } = app.screen;
        const isHeightConstrained = width > height;
        return isHeightConstrained ? height : width;
    };

    private static addBackgroundShape = (
        clearSelectionAndPresence: (dobj: undefined) => void,
        app: PIXI.Application
    ) => {
        const bg: PIXI.Graphics = new PIXI.Graphics();
        bg.beginFill(0x000000);
        bg.drawRect(0, 0, app.screen.width, app.screen.height);
        bg.endFill();
        bg.interactive = true;

        app.stage.addChild(bg);

        bg.on('pointerup', clearSelectionAndPresence);
    };

    public get fluidConnectionState(): ConnectionState {
        return this.container.connectionState;
    }

    // function to toggle the signals flag
    public toggleSignals = (): void => {
        this.useSignals = !this.useSignals;
    };

    public getUseSignals = (): boolean => {
        return this.useSignals;
    };

    // Creates a new FeltShape object which is the local object that represents
    // all shapes on the canvas
    public addNewLocalShape = (shape: Shape): FeltShape => {
        const feltShape = new FeltShape(
            this.pixiApp,
            shape,
            (userId: string) => {
                clearPresence(userId, this.shapeTree);
            },
            (shape: FeltShape) => {
                this.clearSelection();
                this.selection.set(shape.id, shape);
            },
            this.audience,
            this.getUseSignals,
            this.signaler
        );

        this.localShapes.set(shape.id, feltShape); // add the new shape to local data

        return feltShape;
    };

    // function passed into React UX for creating shapes
    public createShape = (shapeType: ShapeType, color: Color): void => {
        if (this.localShapes.maxReached) return;

        addShapeToShapeTree(
            shapeType,
            color,
            Guid.create().toString(),
            FeltShape.size,
            FeltShape.size,
            getMaxZIndex(this.maxZ),
            this.shapeTree
        );
    };

    // function passed into React UX for creating lots of different shapes at once
    public createLotsOfShapes = (amount: number): void => {
        let shapeType = ShapeType.Circle;
        let color = Color.Red;

        for (let index = 0; index < amount; index++) {
            shapeType = getNextShape(shapeType);
            color = getNextColor(color);

            if (this.localShapes.size < shapeLimit) {
                addShapeToShapeTree(
                    shapeType,
                    color,
                    Guid.create().toString(),
                    getRandomInt(
                        FeltShape.size,
                        this.pixiApp.screen.width - FeltShape.size
                    ),
                    getRandomInt(
                        FeltShape.size,
                        this.pixiApp.screen.height - FeltShape.size
                    ),
                    getMaxZIndex(this.maxZ),
                    this.shapeTree
                );
            }
        }
    };

    // Function passed to React to change the color of selected shapes
    public changeColorofSelected = (color: Color): void => {
        this.changeSelectedShapes((shape: FeltShape) =>
            this.changeColor(shape, color)
        );
    };

    // Changes the color of a shape and syncs with the Fluid data
    public changeColor = (shape: FeltShape, color: Color): void => {
        shape.color = color;
    };

    // A function that iterates over all selected shapes and calls the passed function
    // for each shape
    public changeSelectedShapes = (f: Function): void => {
        if (this.selection.size > 0) {
            this.selection.forEach((value: FeltShape | undefined, key: string) => {
                if (value !== undefined) {
                    f(value);
                } else {
                    this.selection.delete(key);
                }
            });
        }
    };

    // Function passed to React to delete selected shapes
    public deleteSelectedShapes = (): void => {
        this.changeSelectedShapes((shape: FeltShape) => this.deleteShape(shape));
    };

    public deleteAllShapes = (): void => {
        this.localShapes.forEach((value: FeltShape, key: string) => {
            this.deleteShape(value);
        });
    };

    private deleteShape = (shape: FeltShape): void => {
        const i = shape.shape[parentField].index;
        //this.shapeTree[de]   [deleteNodes](i, 1);
    };

    // Called when a shape is deleted in the Fluid Data
    public deleteLocalShape = (shape: FeltShape): void => {
        // Remove shape from local map
        this.localShapes.delete(shape.id);

        // Remove the shape from the canvas
        this.selection.delete(shape.id);

        // Destroy the local shape object
        shape.destroy();
    };

    public bringSelectedToFront = (): void => {
        this.changeSelectedShapes((shape: FeltShape) =>
            bringToFront(shape, this.maxZ)
        );
    };

    public clearSelection = (): void => {
        this.selection.forEach((value: FeltShape) => {
            value.unselect();
        });
        this.selection.clear();
    };

    public updateAllShapes = () => {
        console.log('UPDATING ALL SHAPES: ');
        console.log(
            Array.from((this.fluidTree.forest as any).roots.fields.values())[0]
        );
        const seenIds = new Set<string>();
        for (const shape of this.shapeTree.shapes) {
            seenIds.add(shape.id);
            let localShape = this.localShapes.get(shape.id);
            if (localShape != undefined) {
                localShape.shape = shape; // TODO this should not be necessary
                localShape.sync();
            } else {
                localShape = this.addNewLocalShape(shape);
            }
        }

        // delete local shapes that no longer exist
        this.localShapes.forEach((shape: FeltShape) => {
            if (!seenIds.has(shape.id)) {
                this.deleteLocalShape(this.localShapes.get(shape.id)!);
            }
        });
    };
}
