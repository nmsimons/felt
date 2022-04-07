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
    const localMap = new Map<number, FeltShape>();
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

    // Create some shapes
    for (let i = 0; i < shapeCount; i++) {
        // try to get the fluid object if it exists, and update the local objects based on that
        const fluidObj = fluidMap.get(i.toString()) as FluidDisplayObject;
        let shape: FeltShape;
        if (fluidObj) {
            console.log(`Loaded shape ${i + 1} from Fluid.`);
            shape = CreateShape(
                pixiApp,
                getDeterministicShape(i), //we always determine shape type by index
                fluidObj.color, //color is configurable
                size,
                i, // id
                fluidObj.x,
                fluidObj.y,
                setFluidPosition
            );
            Fluid2Pixi(shape, fluidObj);
        } else {
            console.log(`Creating new shape for shape ${i + 1}`);
            shape = CreateShape(
                pixiApp,
                getDeterministicShape(i),
                getDeterministicColor(i),
                size,
                i, //id
                100 + (i * (pixiApp.view.width - 100 - 60 / 2)) / shapeCount, //x
                100, //y
                setFluidPosition
            );
            setFluidPosition(shape);
        }

        localMap.set(i, shape);
        pixiApp.stage.addChild(shape);
    }

    // When shapes are dragged, instead of updating the Fluid data, we send a Signal using fluid. This function will
    // handle the signal we send and update the local state accordingly.
    const fluidDragHandler: SignalListener = (
        clientId: string,
        local: boolean,
        payload: FluidDisplayObject
    ) => {
        if (!local) {
            const localShape = localMap.get(parseInt(payload.id));
            if (localShape) {
                Fluid2Pixi(localShape, payload)
            }
        }
    };
    signaler.onSignal(Signals.ON_DRAG, fluidDragHandler);


    //commit changes to Fluid data
    fluidMap.on('valueChanged', (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const localShape = localMap.get(parseInt(changed.key));
            if (localShape) {
                Fluid2Pixi(localShape, remoteShape);
            }
        }
    });

    ReactDOM.render(
        <UX.ReactApp container={container} audience={audience} shapes={localMap} />,
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

export function CreateShape(
    app: PIXI.Application,
    shape: Shape,
    color: Color,
    size: number,
    id: number,
    x: number,
    y: number,
    setFluidPosition: (
        dobj: FeltShape,
    ) => void
): FeltShape {

    const graphic = new FeltShape();

    //Hack to compare signals with ops
    if ((id + 1) % 2 == 0) {
        graphic.signals = true;
    } else {
        graphic.signals = false;
    }

    graphic.id = id.toString();

    graphic.beginFill(0xffffff);

    switch (shape) {
        case Shape.Circle:
            graphic.drawCircle(0, 0, size / 2);
            break;
        case Shape.Square:
            graphic.drawRect(-size / 2, -size / 2, size, size);
            break;
        case Shape.Triangle:
            size = size * 1.5;
            // eslint-disable-next-line no-case-declarations
            const path = [0, -size / 2, -size / 2, size / 3, size / 2, size / 3];
            graphic.drawPolygon(path);
            break;
        case Shape.Rectangle:
            graphic.drawRect((-size * 1.5) / 2, -size / 2, size * 1.5, size);
            break;
        default:
            graphic.drawCircle(0, 0, size);
            break;
    }

    graphic.endFill();
    console.log(`initializing color to: ${color}`);
    graphic.setColor(color);

    const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 36,
        fontWeight: 'bold',
        fill: '#ffffff',
    });

    const number = new PIXI.Text((id + 1).toString(), style);
    graphic.addChild(number);

    number.anchor.set(0.5);

    graphic.interactive = true;
    graphic.buttonMode = true;
    graphic.x = x;
    graphic.y = y;

    // Pointers normalize touch and mouse
    graphic
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove)
        .on('rightclick', onRightClick);

    app.stage.addChild(graphic);

    function onRightClick(event: any) {
        graphic.setColor(getNextColor(graphic.color));
        graphic.dragging = false;
        setFluidPosition(graphic);
    }

    function onDragStart(event: any) {
        if (event.data.buttons === 1) {
            graphic.alpha = 0.5;
            graphic.zIndex = 9999;
            graphic.dragging = true;
            setFluidPosition(graphic);
        }
    }

    function onDragEnd(event: any) {
        if (graphic.dragging) {
            graphic.alpha = 1;
            graphic.zIndex = id;
            graphic.dragging = false;
            setFluidPosition(graphic);
        }
    }

    function onDragMove(event: any) {
        if (graphic.dragging) {
            graphic.alpha = 0.5;
            graphic.zIndex = 9999;
            updatePosition(event.data.global.x, event.data.global.y);
            setFluidPosition(graphic);
        }
    }

    function updatePosition(x: number, y: number) {
        if (x >= graphic.width / 2 && x <= app.renderer.width - graphic.width / 2) {
            graphic.x = x;
        }

        if (
            y >= graphic.height / 2 &&
            y <= app.renderer.height - graphic.height / 2
        ) {
            graphic.y = y;
        }
    }

    return graphic;
}

export class FeltShape extends PIXI.Graphics {
    frames: number = 0;
    id: string = "";
    dragging: boolean = false;
    signals: boolean = true;
    color: Color = Color.Red;

    public setColor(color: Color) {
        this.color = color;
        this.tint = Number(color);
    }
}

export default main();
