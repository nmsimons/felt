import { Signaler, SignalListener } from "@fluid-experimental/data-objects";
import { EditableField, ISharedTree, parentField } from "@fluid-internal/tree";
import { IAzureAudience } from "@fluidframework/azure-client";
import { SharedCounter } from "@fluidframework/counter";
import { Guid } from "guid-typescript";
import { appSchemaData, ShapeProxy } from "./schema";
import { FeltShape, addShapeToShapeTree, size, getMaxZIndex, shapeLimit, bringToFront, Shapes } from "./shapes";
import { Color, getNextColor, getNextShape, getRandomInt, Shape } from "./util";
import { clearPresence, removeUserFromPresenceArray } from "./presence";
import * as PIXI from 'pixi.js';
import { loadFluidData } from "./fluid";
import { ConnectionState, FluidContainer, IMember } from "fluid-framework";
import { Signal2Pixi, SignalPackage, Signals } from "./wrappers";

export class Application {

    private disconnect: number = 0;
    private dirty: number = 0;

    private constructor (
        public pixiApp: PIXI.Application,
        public selection: Shapes,
        public audience: IAzureAudience,
        public useSignals: boolean,
        public signaler: Signaler,
        public localShapes: Shapes,
        public shapeTree: ShapeProxy[] & EditableField,
        public maxZ: SharedCounter,
        public container: FluidContainer,
        public fluidTree: ISharedTree
    ) {
        // make background clickable
        Application.addBackgroundShape(() => clearPresence(audience.getMyself()?.userId!, shapeTree), pixiApp);

        container.on("connected", () => {
            console.log("CONNECTED after " + (performance.now() - this.disconnect) + " milliseconds.");
        })

        container.on("disconnected", () => {
            this.disconnect = performance.now();
            console.log("DISCONNECTED");
        })

        container.on("saved", () => {
            //console.log("SAVED after " + (performance.now() - dirty) + " milliseconds.");
        })

        container.on("dirty", () => {
            this.dirty = performance.now();
            //console.log("DIRTY");
        })

        //Get all existing shapes
        this.updateAllShapes();

        // event handler for detecting remote changes to Fluid data and updating
        // the local data
        fluidTree.forest.on('afterDelta', (delta) => {
            this.updateAllShapes();
        })

        // When a user leaves the session, remove all that users presence data from
        // the presence shared map. Note, all clients run this code right now
        audience.on('memberRemoved', (clientId: string, member: IMember) => {
            for (const shapeProxy of shapeTree) {
                removeUserFromPresenceArray({userId: member.userId, shapeProxy: shapeProxy});
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

    public static async build(
    ): Promise<Application> {
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
        const fluidTree = container.initialObjects.tree as ISharedTree;
        fluidTree.storedSchema.update(appSchemaData);
        const shapeTree = fluidTree.root as ShapeProxy[] & EditableField;

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
        )
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

    private static WIDTH: number = 500;

    private static HEIGHT: number = 500;

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

    public get fluidConnectionState(): ConnectionState {
        return this.container.connectionState;
    }

    // function to toggle the signals flag
    public toggleSignals = (): void => {
        this.useSignals = !this.useSignals;
    }

    public getUseSignals = (): boolean => {
        return this.useSignals;
    }

    // Creates a new FeltShape object which is the local object that represents
    // all shapes on the canvas
    public addNewLocalShape = (
        shapeProxy: ShapeProxy
    ): FeltShape => {
        const feltShape = new FeltShape(
            this.pixiApp,
            shapeProxy,
            (userId: string) => clearPresence(userId, this.shapeTree),
            this.audience,
            this.getUseSignals,
            this.signaler
        );

        this.localShapes.set(shapeProxy.id, feltShape); // add the new shape to local data

        return feltShape;
    }

    // function passed into React UX for creating shapes
    public createShape = (shape: Shape, color: Color): void => {
        if (this.localShapes.maxReached) return

        addShapeToShapeTree(
            shape,
            color,
            Guid.create().toString(),
            size,
            size,
            getMaxZIndex(this.maxZ),
            this.shapeTree
        );
    }

    // function passed into React UX for creating lots of different shapes at once
    public createLotsOfShapes = (amount: number): void => {
        let shape = Shape.Circle;
        let color = Color.Red;

        for (let index = 0; index < amount; index++) {
            shape = getNextShape(shape);
            color = getNextColor(color);

            if (this.localShapes.size < shapeLimit) {
                addShapeToShapeTree(
                    shape,
                    color,
                    Guid.create().toString(),
                    getRandomInt(size, this.pixiApp.screen.width - size),
                    getRandomInt(size, this.pixiApp.screen.height - size),
                    getMaxZIndex(this.maxZ),
                    this.shapeTree
                );
            }
        }
    }

    // Function passed to React to change the color of selected shapes
    public changeColorofSelected = (color: Color): void => {
        this.changeSelectedShapes((shape: FeltShape) => this.changeColor(shape, color));
    }

    // Changes the color of a shape and syncs with the Fluid data
    public changeColor = (shape: FeltShape, color: Color): void => {
        shape.color = color;
    }

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
    }

    // Function passed to React to delete selected shapes
    public deleteSelectedShapes = (): void => {
        this.changeSelectedShapes((shape: FeltShape) => this.deleteShape(shape));
    }

    public deleteAllShapes = (): void => {
        this.localShapes.forEach((value: FeltShape, key: string) => {
            this.deleteShape(value);
        })
        // shapeTree.deleteNodes(0, shapeTree.length - 1);
    }

    private deleteShape = (shape: FeltShape): void => {
        const i = shape.shapeProxy[parentField].index;
        this.shapeTree.deleteNodes(i, 1);
    }

    // Called when a shape is deleted in the Fluid Data
    public deleteLocalShape = (shape: FeltShape): void => {
        // Remove shape from local map
        this.localShapes.delete(shape.id);

        // Remove the shape from the canvas
        this.selection.delete(shape.id);

        // Destroy the local shape object (Note: the Fluid object still exists, is marked
        // deleted, and is garbage). TODO: Garbage collection
        shape.destroy();
    }

    public bringSelectedToFront = (): void => {
        this.changeSelectedShapes((shape: FeltShape) => bringToFront(shape, this.maxZ));
    }

    public updateAllShapes = () => {

        const seenIds = new Set<string>();

        for (const shapeProxy of this.shapeTree) {

            seenIds.add(shapeProxy.id);

            const localShape = this.localShapes.get(shapeProxy.id);

            if (localShape != undefined) {
                localShape.shapeProxy = shapeProxy; // TODO this should not be necessary
                localShape.sync();
            } else {
                this.addNewLocalShape(shapeProxy);
            }
        }

        this.localShapes.forEach((shape: FeltShape) => {
            if (!seenIds.has(shape.id)) {
                this.deleteLocalShape(this.localShapes.get(shape.id)!);
            } else {
                if (shape.selected) {
                    this.selection.set(shape.id, shape);
                } else {
                    this.selection.delete(shape.id);
                }
            }
        })
    }
}