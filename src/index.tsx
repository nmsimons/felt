import { SignalListener, SignalManager } from '@fluid-experimental/data-objects';
import { IAzureAudience } from '@fluidframework/azure-client';
import { IFluidContainer, SharedDirectory } from 'fluid-framework';
import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { Audience } from './audience';
import { loadFluidData } from './fluid';
import { getDeterministicColor, getDeterministicShape, getRandomColor, Shape } from './util';
import {
    Pixi2Fluid,
    DragSignalPayload,
    FluidDisplayObject,
    Signals,
    Fluid2Pixi,
} from './wrappers';

async function main() {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    const shapeCount = 8;
    const size = 60;

    // Fluid data
    const { container, services } = await loadFluidData();
    const signaler = container.initialObjects.signalManager as SignalManager;
    const audience = services.audience;
    console.log('Loaded container');

    const pixiApp = await initPixiApp();
    const localMap = new Map<number, PIXI.DisplayObject>();
    const fluidMap = container.initialObjects.shapes as SharedDirectory;

    // This function will be called each time a shape is moved around the canvas. It's passed in to the CreateShape
    // function which wires it up to the PIXI events for the shape.
    const setFluidPosition = (
        shapeId: string,
        dobj: PIXI.DisplayObject | PIXI.Sprite | PIXI.Graphics,
        mode: 'dragging' | 'dropped'
    ) => {
        const fobj = Pixi2Fluid(dobj);
        if (mode === 'dragging') {
            // Send a signal with the new (temporary) position
            const payload: DragSignalPayload = {
                x: fobj.x,
                y: fobj.y,
                alpha: fobj.alpha,
                color: fobj.color,
                z: fobj.z,
                shapeId: shapeId,
            };
            signaler.submitSignal(Signals.ON_DRAG, payload);
        } else {
            // Clone the object
            // const clone: FluidDisplayObject = {...fobj};
            // Store the final position in Fluid
            fluidMap.set(shapeId, fobj);
        }
    };

    // When shapes are dragged, instead of updating the Fluid data, we send a Signal using fluid. This function will
    // handle the signal we send and update the local state accordingly.
    const fluidDragHandler: SignalListener = (
        clientId: string,
        local: boolean,
        payload: DragSignalPayload
    ) => {
        const { shapeId, x, y, alpha, z } = payload;
        if (!local) {
            // console.log(`received ${local ? "local" : "remote"} signal from client ${clientId}`)
            // console.log(`id: ${shapeId}, x: ${x}, y: ${y}, alpha: ${alpha}`);
            const index = parseInt(shapeId);
            const localShape = localMap.get(index);
            if (localShape) {
                localShape.x = x;
                localShape.y = y;
                localShape.alpha = alpha;
                localShape.zIndex = z;
            }
        }
    };
    signaler.onSignal(Signals.ON_DRAG, fluidDragHandler);

    // Create some shapes
    for (let i = 0; i < shapeCount; i++) {
        // try to get the fluid object if it exists, and update the local positions based on that
        const fluidObj = fluidMap.get(i.toString()) as FluidDisplayObject;
        let shape: PIXI.Sprite | PIXI.DisplayObject | PIXI.Graphics;
        if (fluidObj) {
            console.log(`Loaded shape ${i + 1} from Fluid.`);
            shape = CreateShape(
                pixiApp,
                getDeterministicShape(i),
                fluidObj.color,
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
                Number(getDeterministicColor(i)),
                size,
                i,
                100 + (i * (pixiApp.view.width - 100 - 60 / 2)) / shapeCount, //x
                100, //y
                setFluidPosition
            );
            setFluidPosition(i.toString(), shape, 'dropped');
        }

        localMap.set(i, shape);
        pixiApp.stage.addChild(shape);
    }

    fluidMap.on('valueChanged', (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const index = parseInt(changed.key);
            const localShape = localMap.get(index)!;
            Fluid2Pixi(localShape, remoteShape);
        }
    });

    ReactDOM.render(
        <ReactApp container={container} audience={audience} />,
        document.getElementById('root')
    );

    document.getElementById('canvas')?.appendChild(pixiApp.view);
}

// eslint-disable-next-line react/prop-types
function ReactApp(props: {
    container: IFluidContainer;
    audience: IAzureAudience;
}): JSX.Element {
    return (
        <>
            <h1>Felt</h1>
            <Audience {...props} />
            <div id="canvas"></div>
        </>
    );
}

async function initPixiApp() {
    // Main app
    const app = new PIXI.Application({ width: 800, height: 500 });

    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.display = 'block';
    app.stage.sortableChildren = true;

    return app;
}

export function CreateShape(
    app: PIXI.Application,
    shape: Shape,
    color: number,
    size: number,
    id: number,
    x: number,
    y: number,
    setFluidPosition: (
        shapeId: string,
        dobj: PIXI.DisplayObject,
        state: 'dragging' | 'dropped'
    ) => void
): PIXI.DisplayObject {
    let dragging: boolean;
    const shapeId = id.toString();

    const graphic = new PIXI.Graphics();

    graphic.beginFill(0xffffff);

    switch (shape) {
        case Shape.Circle:
            // const c = new PIXI.Circle(0,0,size/2)
            // graphic.drawShape(c);
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
    graphic.tint = color;

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
        console.log('onRightClick');
        const c = Number(getRandomColor());
        console.log(`setting color to ${c}`);
        graphic.tint = c;
        setFluidPosition(shapeId, graphic, 'dropped');
    }

    function onDragStart(event: any) {
        if (event.data.buttons === 1) {
            graphic.alpha = 0.5;
            graphic.zIndex = 9999;
            dragging = true;
            //updatePosition(event.data.global.x, event.data.global.y);
            setFluidPosition(shapeId, graphic, 'dragging');
        }
    }

    function onDragEnd(event: any) {
        if (dragging) {
            graphic.alpha = 1;
            graphic.zIndex = id;
            dragging = false;
            setFluidPosition(shapeId, graphic, 'dropped');
        }
    }

    function onDragMove(event: any) {
        if (dragging) {
            graphic.alpha = 0.5;
            graphic.zIndex = 9999;
            updatePosition(event.data.global.x, event.data.global.y);
            setFluidPosition(shapeId, graphic, 'dragging');
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

export default main();
