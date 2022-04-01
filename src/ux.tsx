import React from 'react';
import ReactDOM from 'react-dom';
import { IAzureAudience } from '@fluidframework/azure-client';
import { IFluidContainer, SharedDirectory } from 'fluid-framework';

// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
    container: IFluidContainer;
    audience: IAzureAudience;
}): JSX.Element {
    return (
        <div className="content">
            <Toolbar />
            <Canvas />
            <Audience {...props} />
        </div>
    );
}

// eslint-disable-next-line react/prop-types
export function Toolbar() {
    return (
        <div>UX GOES HERE!!!</div>
    );
}

export function Canvas() {
    return (
        <div id="canvas"></div>
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
                <ul>{memberDisplay}</ul>
            </p>
            <p id="stats">
                <p>
                    Maximum simultaneous clients:{' '}
                    {Math.max(members.length, maxUsers)}
                </p>
            </p>
        </div>
    );
}