import React, { useState, useEffect } from 'react';
import { IAzureAudience } from '@fluidframework/azure-client';
import { IFluidContainer, SharedDirectory } from 'fluid-framework';
import { FeltShape } from '.';
import Icon from '@mdi/react'
import { mdiCircle } from '@mdi/js'
import { mdiShape } from '@mdi/js';
import { mdiSquare } from '@mdi/js';
import { mdiTriangle } from '@mdi/js';
import { mdiRectangle } from '@mdi/js';
import { Shape as S } from './util';


// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
    container: IFluidContainer;
    audience: IAzureAudience;
    shapes: Map<string, FeltShape>;
    createShape: any;
}): JSX.Element {
    return (
        <div className="content">
            <Toolbar {...props} />
            <Canvas />
            <Instructions />
        </div>
    );
}

// eslint-disable-next-line react/prop-types
export function Toolbar(props: { createShape: any }) {

    const test = mdiCircle;

    return (
        <div className='field is-grouped'>
            <ShapeButton icon={mdiCircle} title="Circle" color="red" createFunction={() => props.createShape(S.Circle)} />
            <ShapeButton icon={mdiSquare} title="Square" color="red" createFunction={() => props.createShape(S.Square)} />
            <ShapeButton icon={mdiTriangle} title="Triangle" color="red" createFunction={() => props.createShape(S.Triangle)} />
            <ShapeButton icon={mdiRectangle} title="Rectangle" color="red" createFunction={() => props.createShape(S.Rectangle)} />
        </div>
    );
}

export function ShapeButton(props: { icon: any, title: string, color: string, createFunction: any }) {
    return (
        <p className='control'>
            <button className='button is-large is-white' onClick={props.createFunction}>
                <span className="icon"><Icon path={props.icon}
                    title={props.title}
                    size={2}
                    color={props.color} />
                </span>
            </button>
        </p>
    )
}

export function Canvas() {
    return (
        <div id="canvas"></div>
    )
}

export function Instructions() {
    return (
        <div >
            <p>
                Share the URL incuding the goo at the end to make a picture with some friends.
            </p>
            <p>
                You can make a lot of shapes but you can't delete them.
            </p>
            <p>
                Right-click to change the color of a shape.
            </p>
        </div>
    )
}

export function Audience(props: {
    container: IFluidContainer;
    audience: IAzureAudience;
}): JSX.Element {
    const { container, audience } = props;
    // retrieve all the members currently in the session
    const [members, setMembers] = React.useState(
        Array.from(audience.getMembers().values())
    );

    const myself = audience.getMyself();
    const setMembersCallback = React.useCallback(
        () => setMembers(Array.from(audience.getMembers().values())),
        [setMembers, audience]
    );

    const updateStats = React.useCallback(() => {
        const max =
            (container.initialObjects.stats as SharedDirectory).get<number>(
                'maxUsers'
            ) ?? 0;
        const size = audience.getMembers().size;

        if (size > max) {
            (container.initialObjects.stats as SharedDirectory).set(
                'maxUsers',
                size
            );
        }
    }, [setMembers, audience]);

    const maxUsers =
        (container.initialObjects.stats as SharedDirectory).get<number>(
            'maxUsers'
        ) ?? 0;

    // Setup a listener to update our users when new clients join the session
    React.useEffect(() => {
        container.on('connected', setMembersCallback);
        audience.on('membersChanged', setMembersCallback);
        audience.on('membersChanged', updateStats);
        return () => {
            container.off('connected', () => setMembersCallback);
            audience.off('membersChanged', () => setMembersCallback);
            audience.off('membersChanged', () => updateStats);
        };
    }, [container, audience, setMembersCallback]);

    let memberDisplay: JSX.Element[];
    if (members.length > 3) {
        const membersToShow = members;
        memberDisplay = membersToShow.map((v, k) => (
            <li key={k.toString()}>
                {v.userName} ({v.userId})
            </li>
        ));
    } else {
        memberDisplay = members.map((v, k) => (
            <li key={k.toString()}>
                {v.userName} ({v.userId})
            </li>
        ));
    }

    return (
        <div id="audience">
            <p>
                I am: <strong>{audience.getMyself()?.userName}</strong>
            </p>
            <p>
                Audience ({members.length} members)
            </p>
            <ul>{memberDisplay}</ul>
            <p id="stats">
                Maximum simultaneous clients:{' '}
                {Math.max(members.length, maxUsers)}
            </p>
        </div>
    );
}