import React from 'react';
import ReactDOM from 'react-dom';

import * as UX from './ux';

import './styles.scss';
import { Application } from './application';

async function main() {

    console.log(performance.now() + ": BOOT")

    const application = await Application.build();

    // create the root element for React
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // disable right-click context menu since right-click is reserved
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    // initialize the React UX
    ReactDOM.render(
        <UX.ReactApp
            audience={application.audience}
            createShape={application.createShape}
            createLotsOfShapes={application.createLotsOfShapes}
            changeColor={application.changeColorofSelected}
            deleteShape={application.deleteSelectedShapes}
            deleteAllShapes={application.deleteAllShapes}
            bringToFront={application.bringSelectedToFront}
            toggleSignals={application.toggleSignals}
            signals={application.getUseSignals}
            selectionManager={application.selection}
            localShapes={application.localShapes}
            shapeTree={application.shapeTree}
            stage={application.pixiApp.stage}
        />,
        document.getElementById('root')
    );

    // insert the PIXI canvas in the page
    document.getElementById('canvas')?.appendChild(application.pixiApp!.view);
}

export default main();
