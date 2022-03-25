import * as PIXI from 'pixi.js';
import { CreateShape } from './scenes/helloWorld';
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

export default main();
