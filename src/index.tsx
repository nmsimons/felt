import { SignalListener, SignalManager } from '@fluid-experimental/data-objects';
import { IAzureAudience } from '@fluidframework/azure-client';
import { IFluidContainer, SharedDirectory } from 'fluid-framework';
import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { Audience } from './audience';
import { loadFluidData } from './fluid';
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
                shapeId: shapeId,
            };
            signaler.submitSignal(Signals.ON_DRAG, payload);
        } else {
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
        const { shapeId, x, y, alpha } = payload;
        if (!local) {
            // console.log(`received ${local ? "local" : "remote"} signal from client ${clientId}`)
            // console.log(`id: ${shapeId}, x: ${x}, y: ${y}, alpha: ${alpha}`);
            const index = parseInt(shapeId);
            const localShape = localMap.get(index);
            if (localShape) {
                localShape.x = x;
                localShape.y = y;
                localShape.alpha = alpha;
            }
        }
    };
    signaler.onSignal(Signals.ON_DRAG, fluidDragHandler);

    // Create some shapes
    for (let i = 0; i < 6; i++) {
        const shape = CreateShape(
            pixiApp,
            Shape.Random,
            Color.Random,
            60,
            i + 1,
            setFluidPosition
        );

        // try to get the fluid object if it exists, and update the local positions based on that
        const fluidObj = fluidMap.get(i.toString()) as FluidDisplayObject;
        if (fluidObj) {
            Fluid2Pixi(shape, fluidObj);
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

enum Shape {
    Circle,
    Square,
    Triangle,
    Rectangle,
    Random
}

enum Color {
    Red,
    Green,
    Blue,
    Orange,
    Random
}

export function CreateShape(app: PIXI.Application, shape: Shape, color: Color, size: number, id: number, setFluidPosition: (
    shapeId: string,
    dobj: PIXI.DisplayObject,
    state: 'dragging' | 'dropped'
) => void): PIXI.DisplayObject {
    let dragging: boolean;
    let data: any;
    const shapeId = id.toString();

    const graphic = new PIXI.Graphics();

    if (color === Color.Random) {
        color = getRandomInt(id, (Object.keys(Color).length / 2) - 2);
    }

    switch (color) {
        case Color.Red:
            graphic.beginFill(0xFF0000);
            break;
        case Color.Green:
            graphic.beginFill(0x00FF00);
            break;
        case Color.Blue:
            graphic.beginFill(0x0000FF);
            break;
        case Color.Orange:
            graphic.beginFill(0xFF7F00);
            break;
        default:
            graphic.beginFill(0x888888);
            break;
    }

    if (shape === Shape.Random) {
        shape = getRandomInt(id, (Object.keys(Shape).length / 2) - 2);
    }

    switch (shape) {
        case Shape.Circle:
            graphic.drawCircle(0,0,size/2);
            break;
        case Shape.Square:
            graphic.drawRect(-size/2,-size/2,size,size);
            break;
        case Shape.Triangle:
            size = size * 1.5;
            // eslint-disable-next-line no-case-declarations
            const path = [0, -size/2, -size/2, size/3, size/2, size/3];
            graphic.drawPolygon(path);
            break;
        case Shape.Rectangle:
            graphic.drawRect(-size*1.5/2,-size/2,size*1.5,size);
            break;
        default:
            graphic.drawCircle(0,0,size);
            break;
    }

    graphic.endFill();

    const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 36,
        fontWeight: 'bold',
        fill: '#ffffff',
    });

    const number = new PIXI.Text((id).toString(), style);
    graphic.addChild(number);

    number.anchor.set(0.5);

    graphic.interactive = true;
    graphic.buttonMode = true;
    graphic.x = 100 + (id * (app.view.width - 100)/6);
    graphic.y = 100;

    // Pointers normalize touch and mouse
    graphic
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove);

    app.stage.addChild(graphic);

    function onDragStart(event: any) {
        graphic.alpha = 0.5;
        dragging = true;
        updatePosition(event.data.global.x, event.data.global.y);
        setFluidPosition(shapeId, graphic, 'dragging');
    }

    function onDragEnd(event: any) {
        graphic.alpha = 1;
        dragging = false;
        updatePosition(event.data.global.x, event.data.global.y);
        setFluidPosition(shapeId, graphic, 'dropped');
    }

    function onDragMove(event: any) {
        if (dragging) {
            graphic.alpha = 0.5;
            updatePosition(event.data.global.x, event.data.global.y);
            setFluidPosition(shapeId, graphic, 'dragging');
        }
    }

    function updatePosition(x: number, y: number) {
        if (x >= graphic.width / 2 && x <= app.renderer.width - graphic.width / 2) {
            graphic.x = x;
        }

        if (y >= graphic.height / 2 && y <= app.renderer.height - graphic.height / 2) {
            graphic.y = y;
        }
    }

    return graphic;
}

function getRandomInt(min: number, max: number) : number {
    if (min <= max) {
        return min;
    } else {
        return max - (min - max);
    }
}

export default main();
