import { Signaler, SignalListener } from "@fluid-experimental/data-objects";
import { IAzureAudience } from "@fluidframework/azure-client";
import { SharedCounter } from "@fluidframework/counter";
import { Guid } from "guid-typescript";
import { FeltShape, getMaxZIndex, shapeLimit, bringToFront, Shapes, addShapeToShapeRootDirectory } from "./shapes";
import { Color, getNextColor, getNextShape, getRandomInt, Shape } from "./util";
import { clearPresence, removeUserFromPresenceArray } from "./presence";
import * as PIXI from 'pixi.js';
import { loadFluidData } from "./fluid";
import { ConnectionState, FluidContainer, IDirectory, IDirectoryValueChanged, IMember, ISharedDirectory, IValueChanged, SharedDirectory } from "fluid-framework";
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
        public maxZ: SharedCounter,
        public container: FluidContainer,
        public shapeRootDirectory: IDirectory,
        public sharedDirectory: SharedDirectory
    ) {
        // make background clickable
        Application.addBackgroundShape(() => {
            this.clearSelection();
            clearPresence(audience.getMyself()?.userId!, shapeRootDirectory);
        }, pixiApp);

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

        const isShapeDirectoryValid = (shapeDirectory: IDirectory): boolean => {
            if (shapeDirectory.get("properties") == undefined) return false;
            if (shapeDirectory.get("position") == undefined) return false;
            if (shapeDirectory.get("z") == undefined) return false;
            if (shapeDirectory.get("color") == undefined) return false;
            return true;
        }

        //Get all existing shapes
        for(const shape of shapeRootDirectory.subdirectories()) {
            if (isShapeDirectoryValid(shape[1])) {
                this.addNewLocalShape(shape[1]);
            }
        }

        shapeRootDirectory.on("subDirectoryCreated", (path: string, local: boolean, target: IDirectory) => {
            if (isShapeDirectoryValid(target)) {
                this.addNewLocalShape(target);
            }
        })

        shapeRootDirectory.on("subDirectoryDeleted", (path: string, local: boolean, target: IDirectory) => {
            this.deleteLocalShape(localShapes.get(path));
        })

        sharedDirectory.on("valueChanged",  (changed: IDirectoryValueChanged, local: boolean, target: SharedDirectory) => {
            const shapeDirectory = target.getWorkingDirectory(changed.path);
            if (shapeDirectory == undefined) { return };
            if (isShapeDirectoryValid(shapeDirectory)) {
                if (this.addNewLocalShape(shapeDirectory)) return; // added a new shape
                localShapes.get(shapeDirectory.get("properties").id)?.sync(changed.key); // not new, so sync
            }
        })

        // When a user leaves the session, remove all that users presence data from
        // the presence shared map. Note, all clients run this code right now
        audience.on('memberRemoved', (clientId: string, member: IMember) => {
            console.log(member.userId, "JUST LEFT");
            clearPresence(member.userId, shapeRootDirectory);
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

        // create Fluid shared sub directory for shapes
        const sharedDirectory = container.initialObjects.sharedDirectory as SharedDirectory;
        const shapeRootDirectory = sharedDirectory.createSubDirectory("shapes");

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
            maxZ,
            container,
            shapeRootDirectory,
            sharedDirectory
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
        clearSelectionAndPresence: (dobj: undefined) => void,
        app: PIXI.Application
    ) => {
        var bg: PIXI.Graphics = new PIXI.Graphics();
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
    }

    public getUseSignals = (): boolean => {
        return this.useSignals;
    }

    // Creates a new FeltShape object which is the local object that represents
    // all shapes on the canvas
    public createLocalShape = (
        shapeDirectory: IDirectory
    ): FeltShape => {
        const feltShape = new FeltShape(
            this.pixiApp,
            shapeDirectory,
            (userId: string) => {
                clearPresence(userId, this.shapeRootDirectory);
            },
            (shape: FeltShape) => {
                this.clearSelection();
                this.selection.set(shape.id, shape);
            },
            this.audience,
            this.getUseSignals,
            this.signaler
        );

        return feltShape;
    }

    public addNewLocalShape = (
        shapeDirectory: IDirectory
    ): boolean => {

        if (this.localShapes.has(shapeDirectory.get("properties").id)) return false;

        const feltShape: FeltShape = this.createLocalShape(shapeDirectory);
        this.localShapes.set(feltShape.id, feltShape); // add the new shape to local data
        return true;
    }

    // function passed into React UX for creating shapes
    public createShape = (shape: Shape, color: Color): void => {
        if (this.localShapes.maxReached) return

        const shapeDirectory = addShapeToShapeRootDirectory(
            shape,
            color,
            Guid.create().toString(),
            FeltShape.size,
            FeltShape.size,
            getMaxZIndex(this.maxZ),
            this.sharedDirectory
        )
    }

    // function passed into React UX for creating lots of different shapes at once
    public createLotsOfShapes = (amount: number): void => {
        let shape = Shape.Circle;
        let color = Color.Red;

        for (let index = 0; index < amount; index++) {
            shape = getNextShape(shape);
            color = getNextColor(color);

            if (this.localShapes.size < shapeLimit) {
                addShapeToShapeRootDirectory(
                    shape,
                    color,
                    Guid.create().toString(),
                    getRandomInt(FeltShape.size, this.pixiApp.screen.width - FeltShape.size),
                    getRandomInt(FeltShape.size, this.pixiApp.screen.height - FeltShape.size),
                    getMaxZIndex(this.maxZ),
                    this.sharedDirectory
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
    }

    private deleteShape = (shape: FeltShape): void => {
        this.shapeRootDirectory.deleteSubDirectory(shape.id);
    }

    // Called when a shape is deleted in the Fluid Data
    public deleteLocalShape = (shape: FeltShape | undefined): void => {

        if (shape === undefined) return;

        // Remove shape from local map
        this.localShapes.delete(shape.id);

        // Remove the shape from the canvas
        this.selection.delete(shape.id);

        // Destroy the local shape object (Note: the Fluid object still exists, is marked
        // deleted, and is garbage).
        shape.destroy();
    }

    public bringSelectedToFront = (): void => {
        this.changeSelectedShapes((shape: FeltShape) => bringToFront(shape, this.maxZ));
    }

    public clearSelection = (): void => {
        this.selection.forEach((value: FeltShape) => {
            value.unselect();
        })
        this.selection.clear();
    }
}