import React from 'react';
import { IAzureAudience } from '@fluidframework/azure-client';
import { FeltShape } from '.';
import Icon from '@mdi/react';
import { mdiCircle } from '@mdi/js';
import { mdiSquare } from '@mdi/js';
import { mdiTriangle } from '@mdi/js';
import { mdiRectangle } from '@mdi/js';
import { mdiDeleteForever } from '@mdi/js';
import { mdiPalette } from '@mdi/js';
import { Color, Shape as S } from './util';

// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
    audience: IAzureAudience;
    shapes: Map<string, FeltShape>;
    createShape: any;
    changeColor: any;
    deleteShape: any;
}): JSX.Element {
    return (
        <div>
            <Toolbar {...props} />
            <Canvas />
        </div>
    );
}

// eslint-disable-next-line react/prop-types
export function Toolbar(props: {
    createShape: any;
    changeColor: any;
    deleteShape: any;
    audience: IAzureAudience;
}) {
    const test = mdiCircle;

    return (
        <div className="navbar is-light">
            <div className="navbar-menu">
                <div className="navbar-start">
                    <div className="navbar-item">
                        <div className="field is-grouped">
                            <ShapeButton
                                icon={mdiCircle}
                                title="Circle"
                                color="red"
                                createFunction={() =>
                                    props.createShape(S.Circle, Color.Red)
                                }
                            />
                            <ShapeButton
                                icon={mdiSquare}
                                title="Square"
                                color="blue"
                                createFunction={() =>
                                    props.createShape(S.Square, Color.Blue)
                                }
                            />
                            <ShapeButton
                                icon={mdiTriangle}
                                title="Triangle"
                                color="orange"
                                createFunction={() =>
                                    props.createShape(S.Triangle, Color.Orange)
                                }
                            />
                            <ShapeButton
                                icon={mdiRectangle}
                                title="Rectangle"
                                color="purple"
                                createFunction={() =>
                                    props.createShape(S.Rectangle, Color.Purple)
                                }
                            />
                            <ShapeButton
                                icon={mdiPalette}
                                title="Change color"
                                color="black"
                                createFunction={() =>
                                    props.changeColor()
                                }
                            />
                            <ShapeButton
                                icon={mdiDeleteForever}
                                title="Delete"
                                color="black"
                                createFunction={() =>
                                    props.deleteShape()
                                }
                            />
                        </div>
                    </div>
                </div>
                <div className="navbar-end">
                    <div className="navbar-item">
                        <div className="field is-grouped">
                            <Audience
                                audience={props.audience}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ShapeButton(props: {
    icon: any;
    title: string;
    color: string;
    createFunction: any;
}) {
    return (
        <p className="control">
            <button
                className="button is-large is-white"
                onClick={props.createFunction}
            >
                <span className="icon">
                    <Icon
                        path={props.icon}
                        title={props.title}
                        size={2}
                        color={props.color}
                    />
                </span>
            </button>
        </p>
    );
}

export function Canvas() {
    return <div id="canvas"></div>;
}

export function Audience(props: {
    audience: IAzureAudience;
}): JSX.Element {
    const { audience } = props;

    // retrieve all the members currently in the session
    const [members, setMembers] = React.useState(
        Array.from(audience.getMembers().values())
    );

    const myself = audience.getMyself();
    const setMembersCallback = React.useCallback(
        () => setMembers(Array.from(audience.getMembers().values())),
        [setMembers, audience]
    );

    // Setup a listener to update our users when new clients join the session
    React.useEffect(() => {
        audience.on('membersChanged', setMembersCallback);
        return () => {
            audience.off('membersChanged', () => setMembersCallback);
        };
    }, [audience, setMembersCallback]);

    return (
        <p className="control">
            <button className="button is-large is-white">{members.length}</button>
        </p>
    );
}
