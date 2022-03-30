import { IAzureAudience } from '@fluidframework/azure-client';
import { IFluidContainer } from 'fluid-framework';
import React from 'react';

export function Audience(props: {
    container: IFluidContainer;
    audience: IAzureAudience;
}): JSX.Element {
    const { container, audience } = props;
    // retrieve all the members currently in the session
    const [members, setMembers] = React.useState(
        Array.from(audience.getMembers().values())
    );
    // set the user as the author so the user can be assigned as the author when needed
    const authorInfo = audience.getMyself();
    const setMembersCallback = React.useCallback(
        () => setMembers(Array.from(audience.getMembers().values())),
        [setMembers, audience]
    );
    // Setup a listener to update our users when new clients join the session
    React.useEffect(() => {
        container.on('connected', setMembersCallback);
        audience.on('membersChanged', setMembersCallback);
        return () => {
            container.off('connected', () => setMembersCallback);
            audience.off('membersChanged', () => setMembersCallback);
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
        <>
            <div id="audience">
                <p>
                    I am: <strong>{audience.getMyself()?.userName}</strong>
                </p>
                <p>Audience ({members.length} members)</p>
                <ul>
                    {memberDisplay}
                    {/* {EnumAudience(props.audience)} */}
                </ul>
            </div>
        </>
    );
}
