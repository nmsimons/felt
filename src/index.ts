import { SharedDirectory } from 'fluid-framework';
import * as PIXI from 'pixi.js';
import { getFluidData } from './fluid';
import { FluidText } from './scenes/fluidText';

const load = (app: PIXI.Application) => {
    return new Promise<void>((resolve) => {
        app.loader.add('assets/hello-world.png').load(() => {
            resolve();
        });
    });
};

const main = async () => {
    console.log("beginning of main");
    // Main app
    let app = new PIXI.Application();

    // Display application properly
    document.body.style.margin = '0';
    app.renderer.view.style.position = 'absolute';
    app.renderer.view.style.display = 'block';

    // View size = windows
    app.renderer.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', (e) => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
    });

    // Load assets
    let { container, services } = await getFluidData();
    let root = container.initialObjects.root as SharedDirectory;
    console.log("Loaded container");

    await load(app);
    console.log("Loaded pixi app");
    document.body.appendChild(app.view);

    // Set scene
    var scene = new FluidText(app);
    app.stage.addChild(scene);
    console.log("end of main");
};

main();
