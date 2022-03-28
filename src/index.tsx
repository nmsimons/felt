import { loadFluidData } from './fluid';
import * as PIXI from 'pixi.js';
import React from 'react';
import ReactDOM from 'react-dom';
import { SharedDirectory } from 'fluid-framework';
import { DisplayObject2Fluid, FluidDisplayObject } from './wrappers';

const load = async (app: PIXI.Application) => {
    return new Promise<void>((resolve) => {
        app.loader.add('assets/willow.png').load(() => {
            resolve();
        });
    });
};

async function main() {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // Fluid data
    const { container, services } = await loadFluidData();
    const rootMap = container.initialObjects.root as SharedDirectory;
    console.log('Loaded container');

    const pixiApp = await initPixiApp();

    pixiApp.stage.sortableChildren = true;

    const shapeMap = new Map<number, PIXI.DisplayObject>();
    const shapeDir = container.initialObjects.shapes as SharedDirectory;

    for (let i = 0; i < 6; i++) {
        const shape = CreateShape(pixiApp,
            (dobj: PIXI.DisplayObject) => {
                console.log("Setting fluid position");
                const fobj = DisplayObject2Fluid(dobj);
                shapeDir.set(i.toString(), fobj);
            });
        shapeMap.set(i, shape);
        pixiApp.stage.addChild(shapeMap.get(i)!);
    }

    shapeDir.on("valueChanged", (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const index = parseInt(changed.key);
            const localShape = shapeMap.get(index)!;
            localShape.x = remoteShape.x;
            localShape.y = remoteShape.y;
            localShape.alpha = remoteShape.alpha;
        }
    });

    ReactDOM.render(<ReactApp />, document.getElementById('root'));

    document.getElementById('canvas')?.appendChild(pixiApp.view);
}

function ReactApp() {
    return (
        <>
            <div>Felt</div>
            <div id="canvas"></div>
        </>
    );
}

async function initPixiApp() {
    // Main app
    const app = new PIXI.Application({ width: 800, height: 500 });

    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.display = 'block';

    // Load assets
    await load(app);

    return app;
}

export function CreateShape(app: PIXI.Application, setFluidPosition: (dobj: PIXI.DisplayObject) => void): PIXI.DisplayObject {
    let dragging: boolean;
    let data: any;

    const shape = new PIXI.Graphics();
    shape.beginFill(0xff0000);
    shape.drawCircle(100,100,50);
    shape.interactive = true;
    shape.buttonMode = true;    
    // Pointers normalize touch and mouse
    shape
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove);

    app.stage.addChild(shape);    

    function onDragStart(event: any) {
        // store a reference to the data
        // the reason for this is because of multitouch
        // we want to track the movement of this particular touch
        data = event.data;
        shape.alpha = 0.5;
        setFluidPosition(shape);
        dragging = true;
    }

    function onDragEnd() {
        // const newPosition = data.getLocalPosition(sprite.parent);

        shape.alpha = 1;
        dragging = false;
        setFluidPosition(shape);
        // set the interaction data to null
        data = null;
    }

    function onDragMove() {
        if (dragging) {
            const newPosition = data.getLocalPosition(shape.parent);
            updatePosition(newPosition);
            setFluidPosition(shape);
        }
    }

    function updatePosition(newPosition: PIXI.Point) {
        if (
            newPosition.x > shape.width / 2 &&
            newPosition.x < app.renderer.width - shape.width / 2
        ) {
            shape.x = newPosition.x;

        }

        if (
            newPosition.y > shape.height / 2 &&
            newPosition.y < app.renderer.height - shape.height / 2
        ) {
            shape.y = newPosition.y;
        }
    }

    return shape;
}

export default main();
