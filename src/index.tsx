import { IAzureAudience } from '@fluidframework/azure-client';
import { IFluidContainer, SharedDirectory } from 'fluid-framework';
import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { Audience } from './audience';
import { loadFluidData } from './fluid';
import { DisplayObject2Fluid, FluidDisplayObject } from './wrappers';

async function main() {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // Fluid data
    const { container, services } = await loadFluidData();
    const rootMap = container.initialObjects.root as SharedDirectory;
    const audience = services.audience;
    console.log('Loaded container');

    const pixiApp = await initPixiApp();

    pixiApp.stage.sortableChildren = true;

    const localMap = new Map<number, PIXI.DisplayObject>();
    const fluidMap = container.initialObjects.shapes as SharedDirectory;

    for (let i = 0; i < 6; i++) {
        const shape = CreateShape(
            pixiApp,
            Shape.Random,
            Color.Random,
            60,
            i,
            (dobj: PIXI.DisplayObject) => {
                const fobj = DisplayObject2Fluid(dobj);
                fluidMap.set(i.toString(), fobj);
            }
        );

        // try to get the fluid object if it exists
        const fluidObj = fluidMap.get(i.toString()) as FluidDisplayObject;
        if (fluidObj) {
            shape.x = fluidObj.x;
            shape.y = fluidObj.y;
        }

        localMap.set(i, shape);
        pixiApp.stage.addChild(localMap.get(i)!);
    }

    fluidMap.on('valueChanged', (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const index = parseInt(changed.key);
            const localShape = localMap.get(index)!;
            localShape.x = remoteShape.x;
            localShape.y = remoteShape.y;
            localShape.alpha = remoteShape.alpha;
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
    // const {audience} =
    return (
        <>
            <h1>Felt</h1>
            <Audience {...props} />
            <div id="canvas"></div>
        </>
    );
}
// ReactApp.propTypes = {
//     audience: PropTypes.string.isRequired
//   }

async function initPixiApp() {
    // Main app
    const app = new PIXI.Application({ width: 800, height: 500 });

    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.display = 'block';

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

export function CreateShape(app: PIXI.Application, shape: Shape, color: Color, size: number, id: number, setFluidPosition: (dobj: PIXI.DisplayObject) => void): PIXI.DisplayObject {
    let dragging: boolean;
    let data: any;

    const graphic = new PIXI.Graphics();

    if (color === Color.Random) {
        color = getRandomInt(0, (Object.keys(Color).length / 2) - 2);
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
        shape = getRandomInt(0, (Object.keys(Shape).length / 2) - 2);
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
    }

    function onDragEnd(event: any) {
        graphic.alpha = 1;
        dragging = false;
        updatePosition(event.data.global.x, event.data.global.y);
    }

    function onDragMove(event: any) {
        if (dragging) {
            updatePosition(event.data.global.x, event.data.global.y);
        }
    }

    function updatePosition(x: number, y: number) {
        if (x >= graphic.width / 2 && x <= app.renderer.width - graphic.width / 2) {
            graphic.x = x;
        }

        if (y >= graphic.height / 2 && y <= app.renderer.height - graphic.height / 2) {
            graphic.y = y;
        }

        setFluidPosition(graphic);
    }

    return graphic;
}

function getRandomInt(min: number, max: number) : number{
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default main();
