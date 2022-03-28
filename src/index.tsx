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

    const localMap = new Map<number, PIXI.DisplayObject>();
    const fluidMap = container.initialObjects.shapes as SharedDirectory;

    for (let i = 0; i < 6; i++) {
        const shape = CreateShape(pixiApp,
            (dobj: PIXI.DisplayObject) => {
                console.log("Setting fluid position");
                const fobj = DisplayObject2Fluid(dobj);
                fluidMap.set(i.toString(), fobj);
            });
        localMap.set(i, shape);
        pixiApp.stage.addChild(localMap.get(i)!);
    }

    fluidMap.on("valueChanged", (changed, local, target) => {
        if (!local) {
            const remoteShape = target.get(changed.key) as FluidDisplayObject;
            const index = parseInt(changed.key);
            const localShape = localMap.get(index)!;
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
    shape.drawCircle(0,0,50);
    shape.interactive = true;
    shape.buttonMode = true;
    shape.x = 100;
    shape.y = 100;   
    
    // Pointers normalize touch and mouse
    shape
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove);

    app.stage.addChild(shape);    

    function onDragStart(event: any) {
        
        shape.alpha = 0.5;
        dragging = true;
        updatePosition(event.data.global.x, event.data.global.y);
    }

    function onDragEnd(event: any) {
        shape.alpha = 1;
        dragging = false;
        setFluidPosition(shape);        
    }

    function onDragMove(event: any) {
        if (dragging) {
            updatePosition(event.data.global.x, event.data.global.y);
        }
    }

    function updatePosition(x: number, y: number) {
        if (
            x > shape.width / 2 &&
            x < app.renderer.width - shape.width / 2
        ) {
            shape.x = x;

        }

        if (
            y > shape.height / 2 &&
            y < app.renderer.height - shape.height / 2
        ) {
            shape.y = y;
        }

        setFluidPosition(shape);
    }

    return shape;
}

export default main();
