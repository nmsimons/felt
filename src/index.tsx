import { IMember, SharedMap } from 'fluid-framework';
import { SignalManager, SignalListener } from '@fluid-experimental/data-objects';
import { AzureMember, IAzureAudience } from '@fluidframework/azure-client';

import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { loadFluidData } from './fluid';
import {
    Color,
    getNextColor,
    Shape,
} from './util';
import {
    Pixi2Fluid,
    FluidDisplayObject,
    Signals,
    Fluid2Pixi,
    Pixi2Signal,
    Signal2Pixi,
    SignalPackage
} from './wrappers';
import * as UX from './ux';
import { Guid } from 'guid-typescript';

import './styles.scss';

async function main() {

    // create the root element for React
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // disable right-click context menu since right-click changes shape color
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    // set some constants for shapes
    const shapeLimit = 999;
    const size = 60;

    // Initialize Fluid
    const { container, services } = await loadFluidData();
    const audience = services.audience;

    // create local map for shapes - contains customized PIXI objects
    const localShapes = new Map<string, FeltShape>();
    const signaler = container.initialObjects.signalManager as SignalManager;

    // create local map for selected shapes - contains customized PIXI objects
    const localSelection = new Map<string, FeltShape>();

    const setSelected = async (dobj: FeltShape | undefined) => {

        //Since we don't currently support multi select, clear the current selection
        localSelection.forEach (async (value: FeltShape | undefined, key: string) => {
            if (value !== undefined) {
                value.removeSelection();
                localSelection.delete(value.id);

                const users: string[] = getPresenceArray(value.id);
                removeUserFromPresenceArray(users, audience.getMyself()!.userId);
                fluidPresence.set(value.id, users);
            } else {
                localSelection.delete(key);
            }
        })

        if (dobj !== undefined && dobj.id !==undefined) {
            if (!localSelection.has(dobj.id))
            {
                localSelection.set(dobj.id, dobj);
                const users: string[] = getPresenceArray(dobj.id);
                const userId = audience.getMyself()!.userId;
                flushPresenceArray(users);
                addUserToPresenceArray(users, userId);
                fluidPresence.set(dobj.id, users);
            }
        }

        localSelection.forEach ((value: FeltShape) => {
            value.showSelection();
        })
    }

    const getPresenceArray = (shapeId: string) => {
        const users: string[] | undefined = fluidPresence.get(shapeId);
        if (users === undefined) {
            return [];
        } else {
            return users;
        }
    }

    // create PIXI app
    const pixiApp = await initPixiApp(setSelected);

    // create Fluid map for shapes - contains only the data that needs to be
    // synched between clients
    const fluidShapes = container.initialObjects.shapes as SharedMap;

    const fluidPresence = container.initialObjects.presence as SharedMap;

    // This function will be called each time a shape is moved around the canvas.
    // It's passed in to the CreateShape function which wires it up to the
    // PIXI events for the shape.
    const setFluidPosition = (dobj: FeltShape) => {

        // Store the position in Fluid
        if (dobj.dragging) {
            const sig = Pixi2Signal(dobj);
            signaler.submitSignal(Signals.ON_DRAG, sig);
        } else {
            const fobj = Pixi2Fluid(dobj);
            fluidShapes.set(dobj.id, fobj);
        }
    };

    const addNewLocalShape = (
        shape: Shape,
        color: Color,
        id: string,
        x: number,
        y: number
    ): FeltShape => {
        const fs = new FeltShape(
            pixiApp,
            shape,
            color,
            size,
            id, // id
            x, // x
            y, // y
            setFluidPosition, // function that syncs local data with Fluid
            setSelected, // function that manages local selection
        );

        localShapes.set(id, fs); // add the new shape to local data
        pixiApp.stage.addChild(fs); // add the new shape to the PIXI canvas

        return fs;
    };

    // adds a new shape
    const addNewShape = (
        shape: Shape,
        color: Color,
        id: string,
        x: number,
        y: number
    ) => {
        const fs = addNewLocalShape(shape, color, id, x, y);
        fs.zIndex = 1;
        setFluidPosition(fs);
        setSelected(fs);

        return fs;
    };

    // get the Fluid shapes that already exist
    fluidShapes.forEach((fdo: FluidDisplayObject, id: string) => {
         // add the Fluid shapes to the local shape data
        if (!fdo.deleted) {
            addNewLocalShape(fdo.shape, fdo.color, fdo.id, fdo.x, fdo.y);
        }
    });

    // function passed into React UX for creating shapes
    const createShape = (shape: Shape, color: Color) => {
        if (fluidShapes.size < shapeLimit) {
            const fs = addNewShape(shape, color, Guid.create().toString(), 100, 100);
        }
    };

    const changeColorofSelected = (color: Color) => {
        changeSelectedShapes((shape: FeltShape) => changeColor(shape, color));
    }

    const changeColor = (shape: FeltShape, color: Color) => {
        shape.color = color;
        setFluidPosition(shape);
    }

    const changeSelectedShapes = (f: Function) => {
        if (localSelection.size > 0) {
            localSelection.forEach ((value: FeltShape | undefined, key: string) => {
                if (value !== undefined) {
                    f(value);
                } else {
                    localSelection.delete(key);
                }
            })
        }
    }

    const deleteSelectedShapes = () => {
        changeSelectedShapes((shape: FeltShape) => deleteShape(shape));
    }

    const deleteShape = (shape: FeltShape) => {
        shape.deleted = true;
        setFluidPosition(shape);
        localShapes.delete(shape.id);
        shape.destroy();
    }

    // event handler for detecting remote changes to Fluid data and updating
    // the local data
    fluidShapes.on('valueChanged', (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const localShape = localShapes.get(remoteShape.id);
            if (localShape) {
                if (remoteShape.deleted) {
                    localSelection.delete(localShape.id);
                    deleteShape(localShape);
                } else {
                    Fluid2Pixi(localShape, remoteShape);
                }
            } else {
                if (!remoteShape.deleted) {
                    const newLocalShape = addNewLocalShape(
                        remoteShape.shape,
                        remoteShape.color,
                        remoteShape.id,
                        remoteShape.x,
                        remoteShape.y
                    );
                }
            }
        }
    });

    //When a shape is selected in a client it is added to a special SharedMap - this event fires when that happens
    fluidPresence.on('valueChanged', (changed, local, target) => {
        const remote = target.get(changed.key).slice();
        const me: AzureMember | undefined = audience.getMyself();

        if (me) {
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
    })

    audience.on("memberRemoved", (clientId: string, member: IMember) => {
        fluidPresence.forEach((value: string[], key: string) => {
            removeUserFromPresenceArray(value, member.userId)
            fluidPresence.set(key, value);
        })
    })

    const removeUserFromPresenceArray = (arr: string[], userId: string) => {
        const i = arr.indexOf(userId);
        if (i > -1) {
            arr.splice(i, 1);
            removeUserFromPresenceArray(arr, userId);
        }
    }

    const addUserToPresenceArray = (arr: string[], userId: string) => {
        if (arr.indexOf(userId) === -1){
            arr.push(userId);
        }
    }

    const flushPresenceArray = (arr: string[]) => {
        arr.forEach((value: string, index: number) => {
            if (!audience.getMembers().has(value)){
                arr.splice(index, 1);
            }
        })
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
            shapes={localShapes}
            createShape={createShape}
            changeColor={changeColorofSelected}
            deleteShape={deleteSelectedShapes}
        />,
        document.getElementById('root')
    );

    // insert the PIXI canvas in the page
    document.getElementById('canvas')?.appendChild(pixiApp.view);
}

// initialize the PIXI app
async function initPixiApp(manageSelection: (dobj: undefined) => void) {
    var w = 610;
    var h = 545;
    const app = new PIXI.Application({ width: w, height: h });
    app.stage.sortableChildren = true;

    let bg: PIXI.Graphics = new PIXI.Graphics();
    bg.beginFill(0x000000);
    bg.drawRect(0,0,w,h);
    bg.endFill();
    bg.interactive = true;
    app.stage.addChild(bg);

    bg.on('pointerup', manageSelection);

    return app;
}

// wrapper class for a PIXI shape with a few extra methods and properties
// for creating and managing shapes
export class FeltShape extends PIXI.Graphics {
    id = '';
    dragging = false;
    deleted = false;
    private _color: Color = Color.Red;
    z = 0;
    readonly shape: Shape = Shape.Circle;
    readonly size: number = 90;
    private _selectionFrame: PIXI.Graphics | undefined;
    private _presenceFrame: PIXI.Graphics | undefined;
    private _shape: PIXI.Graphics;

    constructor(
        app: PIXI.Application,
        shape: Shape,
        color: Color,
        size: number,
        id: string,
        x: number,
        y: number,
        setFluidPosition: (dobj: FeltShape) => void,
        setSelected: (dobj: FeltShape) => void
    ) {
        super();
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

        const onDragStart = (event: any) => {
            if (event.data.button === 0) {
                this.zIndex = 2;
                this.dragging = true;
                setFluidPosition(this); // syncs local changes with Fluid data
            }
        };

        const onDragEnd = (event: any) => {
            if (this.dragging) {
                this.zIndex = 1;
                this.dragging = false;
                setFluidPosition(this); // syncs local changes with Fluid data
            }
        };

        const onDragMove = (event: any) => {
            if (this.dragging) {
                updatePosition(event.data.global.x, event.data.global.y);
                setFluidPosition(this); // syncs local changes with Fluid data
            }
        };

        const onSelect = (event: any) => {
            if (event.data.button === 0) {
                setSelected(this);
            }
        };

        // sets local postion and enforces canvas boundary
        const updatePosition = (x: number, y: number) => {
            if (x >= this._shape.width / 2 && x <= app.renderer.width - this._shape.width / 2) {
                this.x = x;
            }

            if (y >= this._shape.height / 2 && y <= app.renderer.height - this._shape.height / 2) {
                this.y = y;
            }
        };

        // intialize event handlers
        this.on('pointerdown', onDragStart)
            .on('pointerup', onDragEnd)
            .on('pointerdown', onSelect)
            .on('pointerupoutside', onDragEnd)
            .on('pointermove', onDragMove)
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
        const left = -this._shape.width/2 - handleSize/2;
        const top = -this._shape.height/2 - handleSize/2;
        const right = this._shape.width/2 - handleSize/2;
        const bottom = this._shape.height/2 - handleSize/2;

        this._selectionFrame.zIndex = 5;

        this.drawFrame(this._selectionFrame, handleSize, biteSize, color, left, top, right, bottom);
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
        const left = -this._shape.width/2 - handleSize/2;
        const top = -this._shape.height/2 - handleSize/2;
        const right = this._shape.width/2 - handleSize/2;
        const bottom = this._shape.height/2 - handleSize/2;

        this._presenceFrame.zIndex = 4;

        this.drawFrame(this._presenceFrame, handleSize, biteSize, color, left, top, right, bottom);
    }

    public removePresence() {
        this._presenceFrame?.clear();
    }

    private drawFrame(frame: PIXI.Graphics,
            handleSize: number,
            biteSize: number,
            color: number,
            left: number,
            top: number,
            right: number,
            bottom: number) {

        frame.beginFill(color);
        frame.drawRect(left,top,handleSize,handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(left+biteSize,top+biteSize,handleSize-biteSize,handleSize-biteSize);
        frame.endHole();

        frame.beginFill(color);
        frame.drawRect(left,bottom,handleSize,handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(left+biteSize,bottom,handleSize-biteSize,handleSize-biteSize);
        frame.endHole();

        frame.beginFill(color);
        frame.drawRect(right,top,handleSize,handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(right,top+biteSize,handleSize-biteSize,handleSize-biteSize);
        frame.endHole();

        frame.beginFill(color);
        frame.drawRect(right,bottom,handleSize,handleSize);
        frame.endFill();
        frame.beginHole();
        frame.drawRect(right,bottom,handleSize-biteSize,handleSize-biteSize);
        frame.endHole();
    }

    private setShape() {
        switch (this.shape) {
            case Shape.Circle:
                this._shape.drawCircle(0, 0, this.size / 2);
                break;
            case Shape.Square:
                this._shape.drawRect(-this.size / 2, -this.size / 2, this.size, this.size);
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
