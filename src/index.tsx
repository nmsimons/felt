import * as PIXI from 'pixi.js';
import React, { useState } from 'react';
import ReactDOM from 'react-dom';

const load = (app: PIXI.Application) => {
    return new Promise<void>((resolve) => {
        app.loader.add('assets/willow.png').load(() => {
            resolve();
        });
    });
};

async function main() {    
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root)
    
    const pixiApp = await initPixiApp();

    pixiApp.stage.sortableChildren = true;

    let shapeMap = new Map<number, PIXI.DisplayObject>();

    for (let i = 0; i < 6; i++) {
        shapeMap.set(i, CreateShape(pixiApp));
        pixiApp.stage.addChild(shapeMap.get(i)!);
    }    

    ReactDOM.render (
        <ReactApp/>,
        document.getElementById('root')
    )

    document.getElementById("canvas")?.appendChild(pixiApp.view);
};

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
    const app = new PIXI.Application({width: 800, height: 500});

    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.display = 'block';    
    
    // Load assets
    await load(app);    

    return app;
};

export function CreateShape(app: PIXI.Application): PIXI.DisplayObject {       
    
    var dragging: any;
    var data: any;

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
            sprite.x = newPosition.x;
            sprite.y = newPosition.y;            
        }
    }

    return sprite;
}

export default main();
