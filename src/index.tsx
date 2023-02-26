import { IMember } from 'fluid-framework';
import { SignalListener } from '@fluid-experimental/data-objects';

import React from 'react';
import ReactDOM from 'react-dom';

import {
    Signals,
    Signal2Pixi,
    SignalPackage,
} from './wrappers';
import * as UX from './ux';
import { removeUserFromPresenceArray } from "./presence"

import './styles.scss';
import { Application } from './application';

async function main() {
    let disconnect: number = 0;
    let dirty: number = 0;

    console.log(performance.now() + ": BOOT")

    const application = await Application.build();

    application.container.on("connected", () => {
        console.log("CONNECTED after " + (performance.now() - disconnect) + " milliseconds.");
        updateAllShapes();
    })

    application.container.on("disconnected", () => {
        disconnect = performance.now();
        console.log("DISCONNECTED");
    })

    application.container.on("saved", () => {
        //console.log("SAVED after " + (performance.now() - dirty) + " milliseconds.");
    })

    application.container.on("dirty", () => {
        dirty = performance.now();
        //console.log("DIRTY");
    })

    // create the root element for React
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // disable right-click context menu since right-click is reserved
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    //Get all existing shapes
    updateAllShapes();

    // event handler for detecting remote changes to Fluid data and updating
    // the local data
    application.fluidTree.forest.on('afterDelta', (delta) => {
        updateAllShapes();
    })

    function updateAllShapes() {
        for (let i = application.shapeTree.length - 1; i >= 0; i--) {
            const shapeProxy = application.shapeTree[i];

            const localShape = application.localShapes.get(shapeProxy.id);

            if (localShape != undefined) {
                localShape.shapeProxy = shapeProxy; // TODO this should not be necessary
                if (shapeProxy.deleted) {
                    application.deleteLocalShape(application.localShapes.get(shapeProxy.id)!);
                } else {
                    localShape.sync();
                }
            } else if (!shapeProxy.deleted) {
                application.addNewLocalShape(shapeProxy);
            }
        }
    }

    // When a user leaves the session, remove all that users presence data from
    // the presence shared map. Note, all clients run this code right now
    application.audience.on('memberRemoved', (clientId: string, member: IMember) => {
        for (let i = 0; i < application.shapeTree.length; i++) {
            const shapeProxy = application.shapeTree[i];
            removeUserFromPresenceArray({userId: member.userId, shapeProxy: shapeProxy});
        }
    });

    // When shapes are dragged, instead of updating the Fluid data, we send a Signal using fluid. This function will
    // handle the signal we send and update the local state accordingly.
    const signalHandler: SignalListener = (
        clientId: string,
        local: boolean,
        payload: SignalPackage
    ) => {
        if (!local) {
            const localShape = application.localShapes.get(payload.id);
            if (localShape) {
                Signal2Pixi(localShape, payload);
            }
        }
    };

    application.signaler.onSignal(Signals.ON_DRAG, signalHandler);

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
