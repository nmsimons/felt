import { getFluidData } from './fluid';
import * as PIXI from 'pixi.js';
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { FluidContainer, SharedDirectory } from 'fluid-framework';
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
    const { container, services } = await getFluidData();
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
    let dragging: any;
    let data: any;

    const sprite = new PIXI.Sprite(
        app.loader.resources['assets/willow.png'].texture
    );
    sprite.x = 100;
    sprite.y = 100;
    sprite.anchor.set(0.5);

    sprite.interactive = true;
    sprite.buttonMode = true;

    // Pointers normalize touch and mouse
    sprite
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove);

    // Alternatively, use the mouse & touch events:
    // sprite.on('click', onClick); // mouse-only
    // sprite.on('tap', onClick); // touch-only

    app.stage.addChild(sprite);

    function onClick() {
        sprite.scale.x *= 1.25;
        sprite.scale.y *= 1.25;
    }

    function onDragStart(event: any) {
        // store a reference to the data
        // the reason for this is because of multitouch
        // we want to track the movement of this particular touch
        data = event.data;
        sprite.alpha = 0.5;
        dragging = true;
    }

    function onDragEnd() {
        sprite.alpha = 1;
        dragging = false;
        // set the interaction data to null
        data = null;
    }

    function onDragMove() {
        if (dragging) {
            const newPosition = data.getLocalPosition(sprite.parent);

            if (
                newPosition.x > sprite.width / 2 &&
                newPosition.x < app.renderer.width - sprite.width / 2
            ) {
                sprite.x = newPosition.x;

            }

            if (
                newPosition.y > sprite.height / 2 &&
                newPosition.y < app.renderer.height - sprite.height / 2
            ) {
                sprite.y = newPosition.y;
            }
            setFluidPosition(sprite);
        }
    }

    return sprite;
}

export default main();
