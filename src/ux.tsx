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
import { mdiShape } from '@mdi/js';
import { mdiCloseThick } from '@mdi/js';
import { Color, Shape as S } from './util';

// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
    audience: IAzureAudience;
    shapes: Map<string, FeltShape>;
    createShape: any;
    changeColor: any;
    deleteShape: any;
}): JSX.Element {

    const keyDownHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case "Delete": {
                props.deleteShape();
            }
            default: { }
        }
    }

    window.addEventListener('keydown', (event) => keyDownHandler(event))

    return (
        <div>
            <Toolbar {...props} />
            <Canvas />
            <StatusBar {...props} />
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
    const shapeButtonColor = "black"

    return (
        <div className="level is-light mb-3 mt-3">
            <div className="level-left">
                <div className="level-item">
                    <div className="field has-addons">
                        <ShapeButton
                            icon={mdiCircle}
                            title="Circle"
                            color={shapeButtonColor}
                            createFunction={() =>
                                props.createShape(S.Circle, Color.Red)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Square"
                            color={shapeButtonColor}
                            createFunction={() =>
                                props.createShape(S.Square, Color.Blue)
                            }
                        />
                        <ShapeButton
                            icon={mdiTriangle}
                            title="Triangle"
                            color={shapeButtonColor}
                            createFunction={() =>
                                props.createShape(S.Triangle, Color.Orange)
                            }
                        />
                        <ShapeButton
                            icon={mdiRectangle}
                            title="Rectangle"
                            color={shapeButtonColor}
                            createFunction={() =>
                                props.createShape(S.Rectangle, Color.Purple)
                            }
                        />
                    </div>
                </div>
                <div className="level-item">
                    <div className="field has-addons">
                        <ShapeButton
                            icon={mdiSquare}
                            title="Red"
                            color="Red"
                            createFunction={() =>
                                props.changeColor(Color.Red)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Green"
                            color="Green"
                            createFunction={() =>
                                props.changeColor(Color.Green)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Blue"
                            color="Blue"
                            createFunction={() =>
                                props.changeColor(Color.Blue)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Orange"
                            color="Orange"
                            createFunction={() =>
                                props.changeColor(Color.Orange)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Purple"
                            color="Purple"
                            createFunction={() =>
                                props.changeColor(Color.Purple)
                            }
                        />
                    </div>

                </div>
                <div className="level-item">
                    <ShapeButton
                        icon={mdiCloseThick}
                        title="Delete"
                        color={shapeButtonColor}
                        createFunction={() =>
                            props.deleteShape()
                        }
                    />
                </div>

            </div>
        </div>
    );
}

export function LabelIcon(props: {
    icon: any;
}) {

    return (
        <Icon className="mr-1"
            path={props.icon}
            size={1}
            color="Gray"
        />
    )
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
                className="button is-normal is-light"
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

export function StatusBar(props: {
    audience: IAzureAudience;
}) {

    return (
        <div className="level is-light mb-3 mt-3">
            <div className="level-item">
                <Audience
                    audience={props.audience}
                />
            </div>
        </div>
    );
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
        <div>Current co-creators: {members.length - 1}</div>
    );
}
