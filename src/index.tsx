import { SignalListener, SignalManager } from '@fluid-experimental/data-objects';
import { SharedDirectory } from 'fluid-framework';
import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { loadFluidData } from './fluid';
import {
    Color,
    getDeterministicColor,
    getDeterministicShape,
    getNextColor,
    Shape,
} from './util';
import {
    Pixi2Fluid,
    FluidDisplayObject,
    Signals,
    Fluid2Pixi,
} from './wrappers';
import * as UX from './ux';
import { Guid } from "guid-typescript";

import './styles.scss';

async function main() {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // disable right-click context menu since right-click changes shape color
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    const shapeCount: number = 8;
    const size: number = 60;

    // Fluid data
    const { container, services } = await loadFluidData();
    const signaler = container.initialObjects.signalManager as SignalManager;
    const audience = services.audience;
    console.log('Loaded Fluid container');

    const pixiApp = await initPixiApp();
    const localMap = new Map<string, FeltShape>();
    const fluidMap = container.initialObjects.shapes as SharedDirectory;

    // This function will be called each time a shape is moved around the canvas. It's passed in to the CreateShape
    // function which wires it up to the PIXI events for the shape.
    const setFluidPosition = (
        dobj: FeltShape
    ) => {
        const fobj = Pixi2Fluid(dobj);
        if (dobj.dragging && dobj.signals) {
            // Send a signal with the new (temporary) position
            signaler.submitSignal(Signals.ON_DRAG, fobj);
        } else if (dobj.dragging && !dobj.signals) {
            fluidMap.set(dobj.id, fobj);
        } else {
            // Store the final position in Fluid
            fluidMap.set(dobj.id, fobj);
        }
    };

    const addNewLocalShape = (shape: Shape, color: Color, id: string, x: number, y: number
    ): FeltShape => {
        const fs = new FeltShape(
            pixiApp,
            shape,
            color,
            size,
            id, //id
            x, //x
            y, //y
            setFluidPosition
        );

        localMap.set(id, fs);
        pixiApp.stage.addChild(fs);

        return fs;
    }

    const addNewShape = (shape: Shape, color: Color, id: string, x: number, y: number
        ) => {
            const fs = addNewLocalShape(
                shape,
                color,
                id,
                x,
                y,
            )
            setFluidPosition(fs);
        }

    //Get the Fluid shapes that already exist
    fluidMap.forEach((fdo: FluidDisplayObject, id: string) => {
        console.log(`Loaded shape ${fdo.id} from Fluid.`);
        addNewLocalShape(
            fdo.shape,
            fdo.color,
            fdo.id,
            fdo.x,
            fdo.y
        )
    }
    )

    const createShapes = () => {
        if (fluidMap.size === 0) {
            for (let i = 0; i < shapeCount; i++) {
                console.log(`Creating new shape for shape ${i + 1}`);
                addNewShape(
                    getDeterministicShape(i),
                    getDeterministicColor(i),
                    (i + 1).toString(), //id
                    100 + (i * (pixiApp.view.width - 100 - 60 / 2)) / shapeCount, //x
                    100, //y
                )
            }
        }
    }

    const createShape = (shape: Shape) => {
        addNewShape(
            shape,
            Color.Red,
            Guid.create().toString(),
            100,
            100,
        )
    }

    // When shapes are dragged, instead of updating the Fluid data, we send a Signal using fluid. This function will
    // handle the signal we send and update the local state accordingly.
    const fluidDragHandler: SignalListener = (
        clientId: string,
        local: boolean,
        payload: FluidDisplayObject
    ) => {
        if (!local) {
            const localShape = localMap.get(payload.id);
            if (localShape) {
                Fluid2Pixi(localShape, payload)
            }
        }
    };
    signaler.onSignal(Signals.ON_DRAG, fluidDragHandler);

    //commit changes to Fluid data
    fluidMap.on('valueChanged', (changed, local, target) => {
        console.log('Fluid data updated');
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const localShape = localMap.get(changed.key);
            if (localShape) {
                Fluid2Pixi(localShape, remoteShape);
            } else {
                console.log("Creating shape from Fluid");
                addNewLocalShape(
                    remoteShape.shape,
                    remoteShape.color,
                    remoteShape.id,
                    remoteShape.x,
                    remoteShape.y,
                )
            }
        }
    });

    ReactDOM.render(
        <UX.ReactApp container={container} audience={audience} shapes={localMap} createShape={createShape} />,
        document.getElementById('root')
    );

    document.getElementById('canvas')?.appendChild(pixiApp.view);
}

async function initPixiApp() {
    // Main app
    const app = new PIXI.Application();
    app.stage.sortableChildren = true;

    return app;
}

export class FeltShape extends PIXI.Graphics {
    frames: number = 0;
    id: string = "";
    dragging: boolean = false;
    signals: boolean = true;
    private _color: Color = Color.Red;
    z: number = 0;
    readonly shape: Shape = Shape.Circle;
    readonly size: number = 90;

    constructor(
        app: PIXI.Application,
        shape: Shape,
        color: Color,
        size: number,
        id: string,
        x: number,
        y: number,
        setFluidPosition: (
            dobj: FeltShape,
        ) => void
    ) {

        super();
        this.signals = true;
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

        const onRightClick = (event: any) => {
            this.color = getNextColor(this.color);
            this.dragging = false;
            setFluidPosition(this);
        }

        const onDragStart = (event: any) => {
            if (event.data.buttons === 1) {
                this.alpha = 0.5;
                this.zIndex = 9999;
                this.dragging = true;
                setFluidPosition(this);
            }
        }

        const onDragEnd = (event: any) => {
            if (this.dragging) {
                this.alpha = 1;
                this.zIndex = this.z;
                this.dragging = false;
                setFluidPosition(this);
            }
        }

        const onDragMove = (event: any) => {
            if (this.dragging) {
                this.alpha = 0.5;
                this.zIndex = 9999;
                updatePosition(event.data.global.x, event.data.global.y);
                setFluidPosition(this);
            }
        }

        const updatePosition = (x: number, y: number) => {
            if (x >= this.width / 2 && x <= app.renderer.width - this.width / 2) {
                this.x = x;
            }

            if (y >= this.height / 2 &&
                y <= app.renderer.height - this.height / 2) {
                this.y = y;
            }
        }

        // Pointers normalize touch and mouse
        this
            .on('pointerdown', onDragStart)
            .on('pointerup', onDragEnd)
            .on('pointerupoutside', onDragEnd)
            .on('pointermove', onDragMove)
            .on('rightclick', onRightClick);
    }

    set color(color: Color) {
        this._color = color;
        this.tint = Number(color);
    }

    get color() {
        return this._color;
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
                const path = [0, -(this.size/2), -(this.size/2), this.size/2, this.size/2, this.size/2];
                this.drawPolygon(path);
                break;
            case Shape.Rectangle:
                this.drawRect((-this.size * 1.5) / 2, -this.size / 2, this.size * 1.5, this.size);
                break;
            default:
                this.drawCircle(0, 0, this.size);
                break;
        }
    }

    private addLabel(label: string) {
        const style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fontWeight: 'bold',
            fill: '#ffffff',
        });
        const number = new PIXI.Text(label, style);
        this.addChild(number);
        number.anchor.set(0.5);
    }
}

export default main();
