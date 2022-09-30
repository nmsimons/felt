import { SharedMap } from 'fluid-framework';
import { SignalManager } from '@fluid-experimental/data-objects';
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
    Fluid2Pixi
} from './wrappers';
import * as UX from './ux';
import { Guid } from 'guid-typescript';

import './styles.scss';
import { NullBlobStorageService } from '@fluidframework/routerlicious-driver';

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
    const localMap = new Map<string, FeltShape>();
    const signaler = container.initialObjects.signalManager as SignalManager;

    // create local map for selected shapes - contains customized PIXI objects
    const localSelectionMap = new Map<string, FeltShape>();

    const setSelected = (dobj: FeltShape | undefined) => {

        localSelectionMap.forEach ((value: FeltShape | undefined) => {
            if (value) {
                value.showUnselected();
                localSelectionMap.delete(value.id);
            }
        })

        if (dobj) {
            if (!(dobj.id === undefined) && !localSelectionMap.has(dobj.id))
            {
                localSelectionMap.set(dobj.id, dobj);
            }
        }

        localSelectionMap.forEach ((value: FeltShape) => {
            value.showSelected();
        })

        const [firstKey] = localSelectionMap.keys();

        console.log(firstKey);
        console.log(localSelectionMap.size);
    }

    // create PIXI app
    const pixiApp = await initPixiApp(setSelected);

    // create Fluid map for shapes - contains only the data that needs to be
    // synched between clients
    const fluidMap = container.initialObjects.shapes as SharedMap;

    // This function will be called each time a shape is moved around the canvas.
    // It's passed in to the CreateShape function which wires it up to the
    // PIXI events for the shape.
    const setFluidPosition = (dobj: FeltShape) => {
        const fobj = Pixi2Fluid(dobj);
        // Store the position in Fluid
        fluidMap.set(dobj.id, fobj);
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

        localMap.set(id, fs); // add the new shape to local data
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
        setFluidPosition(fs);

        return fs;
    };

    // get the Fluid shapes that already exist
    fluidMap.forEach((fdo: FluidDisplayObject, id: string) => {
         // add the Fluid shapes to the local shape data
        if (!fdo.deleted) {
            addNewLocalShape(fdo.shape, fdo.color, fdo.id, fdo.x, fdo.y);
        }
    });

    // function passed into React UX for creating shapes
    const createShape = (shape: Shape, color: Color) => {
        if (fluidMap.size < shapeLimit) {
            const fs = addNewShape(shape, color, Guid.create().toString(), 100, 100);
            setSelected(fs);
        }
    };

    const changeColorofSelected = () => {
        if (localSelectionMap.size > 0) {
            localSelectionMap.forEach ((value: FeltShape | undefined) => {
                if (value != undefined) {
                    changeColor(value, getNextColor(value.color));
                } else {
                    setSelected(undefined);
                }
            })
        }
    }

    const changeColor = (shape: FeltShape, color: Color) => {
        shape.color = getNextColor(color);
        setFluidPosition(shape);
    }

    const deleteSelectedShapes = () => {
        if (localSelectionMap.size > 0) {
            localSelectionMap.forEach ((value: FeltShape | undefined) => {
                if (value != undefined) {
                    setSelected(undefined);
                    deleteShape(value);
                } else {
                    setSelected(undefined);
                }
            })
        }
    }

    const deleteShape = (value: FeltShape) => {
        value.deleted = true;
        setFluidPosition(value);
        localMap.delete(value.id);
        value.destroy();
    }

    // event handler for detecting remote changes to Fluid data and updating
    // the local data
    fluidMap.on('valueChanged', (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const localShape = localMap.get(changed.key);
            if (localShape) {
                if (remoteShape.deleted) {
                    localSelectionMap.delete(localShape.id);
                    deleteShape(localShape);
                } else {
                    Fluid2Pixi(localShape, remoteShape);
                }
            } else {
                if (!remoteShape.deleted) {
                    console.log('Creating shape from Fluid');
                    addNewLocalShape(
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

    // initialize the React UX
    ReactDOM.render(
        <UX.ReactApp
            container={container}
            audience={audience}
            shapes={localMap}
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
    private _color: Color = Color.Red;
    z = 0;
    readonly shape: Shape = Shape.Circle;
    readonly size: number = 90;
    private _selectionFrame: PIXI.Graphics | undefined;
    private _deleted: boolean = false;

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

        this.beginFill(0xffffff);

        this.setShape();

        this.endFill();
        console.log(`initializing color to: ${color}`);
        this.color = color;

        this.interactive = true;
        this.buttonMode = true;
        this.x = x;
        this.y = y;

        const onDragStart = (event: any) => {
            if (event.data.buttons === 1) {
                this.zIndex = 9999;
                this.dragging = true;
                //this.selected = false;
                setFluidPosition(this); // syncs local changes with Fluid data
            }
        };

        const onDragEnd = (event: any) => {
            if (this.dragging) {
                this.zIndex = this.z;
                this.dragging = false;
                setFluidPosition(this); // syncs local changes with Fluid data
            }
        };

        const onDragMove = (event: any) => {
            if (this.dragging) {
                this.zIndex = 9999;
                updatePosition(event.data.global.x, event.data.global.y);
                setFluidPosition(this); // syncs local changes with Fluid data
            }
        };

        const onSelect = (event: any) => {
            setSelected(this);
        };

        // sets local postion and enforces canvas boundary
        const updatePosition = (x: number, y: number) => {
            if (x >= this.width / 2 && x <= app.renderer.width - this.width / 2) {
                this.x = x;
            }

            if (y >= this.height / 2 && y <= app.renderer.height - this.height / 2) {
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
        this.tint = Number(color);
    }

    get color() {
        return this._color;
    }

    set deleted(value: boolean) {
        this._deleted = value;
    }

    get deleted() {
        return this._deleted
    }

    public showSelected() {

        if (!this._selectionFrame) {
            this._selectionFrame = new PIXI.Graphics();
            this.addChild(this._selectionFrame);
        }

        this._selectionFrame.clear();

        const handleSize = 16;
        const biteSize = 4;
        const color = 0xffffff;
        const left = -this.width/2 - handleSize/2;
        const top = -this.height/2 - handleSize/2;
        const right = this.width/2 - handleSize/2;
        const bottom = this.height/2 - handleSize/2;


        this._selectionFrame.beginFill(color);
        this._selectionFrame.drawRect(left,top,handleSize,handleSize);
        this._selectionFrame.endFill();
        this._selectionFrame.beginHole();
        this._selectionFrame.drawRect(left+biteSize,top+biteSize,handleSize-biteSize,handleSize-biteSize);
        this._selectionFrame.endHole();

        this._selectionFrame.beginFill(color);
        this._selectionFrame.drawRect(left,bottom,handleSize,handleSize);
        this._selectionFrame.endFill();
        this._selectionFrame.beginHole();
        this._selectionFrame.drawRect(left+biteSize,bottom,handleSize-biteSize,handleSize-biteSize);
        this._selectionFrame.endHole();

        this._selectionFrame.beginFill(color);
        this._selectionFrame.drawRect(right,top,handleSize,handleSize);
        this._selectionFrame.endFill();
        this._selectionFrame.beginHole();
        this._selectionFrame.drawRect(right,top+biteSize,handleSize-biteSize,handleSize-biteSize);
        this._selectionFrame.endHole();

        this._selectionFrame.beginFill(color);
        this._selectionFrame.drawRect(right,bottom,handleSize,handleSize);
        this._selectionFrame.endFill();
        this._selectionFrame.beginHole();
        this._selectionFrame.drawRect(right,bottom,handleSize-biteSize,handleSize-biteSize);
        this._selectionFrame.endHole();
    }

    public showUnselected() {
        this._selectionFrame?.clear();
    }

    private setShape() {
        switch (this.shape) {
            case Shape.Circle:
                this.drawCircle(0, 0, this.size / 2);
                break;
            case Shape.Square:
                this.drawRect(-this.size / 2, -this.size / 2, this.size, this.size);
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
                this.drawPolygon(path);
                break;
            case Shape.Rectangle:
                this.drawRect(
                    (-this.size * 1.5) / 2,
                    -this.size / 2,
                    this.size * 1.5,
                    this.size
                );
                break;
            default:
                this.drawCircle(0, 0, this.size);
                break;
        }
    }
}

export default main();
