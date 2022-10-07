import React from 'react';
import { IAzureAudience } from '@fluidframework/azure-client';
import Icon from '@mdi/react';
import { mdiCircle } from '@mdi/js';
import { mdiSquare } from '@mdi/js';
import { mdiTriangle } from '@mdi/js';
import { mdiRectangle } from '@mdi/js';
import { mdiCloseThick } from '@mdi/js';
import { mdiArrangeBringForward } from '@mdi/js';
import { Color, Shape as S } from './util';

// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
    audience: IAzureAudience;
    createShape: any;
    changeColor: any;
    deleteShape: any;
    bringToFront: any;
    selected: () => boolean;
}): JSX.Element {

    const keyDownHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case "Delete": {
                props.deleteShape();
            }
            default: { }
        }
    }
    React.useEffect(() => {
        window.addEventListener('keydown', (event) => keyDownHandler(event));
    }, [])

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
    bringToFront: any;
    audience: IAzureAudience;
    selected: () => boolean;
}) {
    const shapeButtonColor = "black"

    React.useEffect(() => {
        window.addEventListener('onselection', () => getSelected(props.selected));
    }, [])

    const [selected, getSelected] = React.useState(props.selected);

    return (
        <div className="level is-light mb-3 mt-3">
            <div className="level-left">
                <div className="level-item">
                    <div className="field has-addons">
                        <ShapeButton
                            icon={mdiCircle}
                            title="Circle"
                            color={shapeButtonColor}
                            disabled={false}
                            createFunction={() =>
                                props.createShape(S.Circle, Color.Red)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Square"
                            color={shapeButtonColor}
                            disabled={false}
                            createFunction={() =>
                                props.createShape(S.Square, Color.Blue)
                            }
                        />
                        <ShapeButton
                            icon={mdiTriangle}
                            title="Triangle"
                            color={shapeButtonColor}
                            disabled={false}
                            createFunction={() =>
                                props.createShape(S.Triangle, Color.Orange)
                            }
                        />
                        <ShapeButton
                            icon={mdiRectangle}
                            title="Rectangle"
                            color={shapeButtonColor}
                            disabled={false}
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
                            disabled={!selected}
                            createFunction={() =>
                                props.changeColor(Color.Red)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Green"
                            color="Green"
                            disabled={!selected}
                            createFunction={() =>
                                props.changeColor(Color.Green)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Blue"
                            color="Blue"
                            disabled={!selected}
                            createFunction={() =>
                                props.changeColor(Color.Blue)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Orange"
                            color="Orange"
                            disabled={!selected}
                            createFunction={() =>
                                props.changeColor(Color.Orange)
                            }
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Purple"
                            color="Purple"
                            disabled={!selected}
                            createFunction={() =>
                                props.changeColor(Color.Purple)
                            }
                        />
                    </div>

                </div>
                <div className="level-item">
                    <ShapeButton
                        icon={mdiArrangeBringForward}
                        title="Bring to front"
                        color={shapeButtonColor}
                        disabled={!selected}
                        createFunction={() =>
                            props.bringToFront()
                        }
                    />
                    <ShapeButton
                        icon={mdiCloseThick}
                        title="Delete"
                        color={shapeButtonColor}
                        disabled={!selected}
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
    disabled: boolean;
}) {
    return (
        <p className="control">
            <button
                className="button is-normal is-light"
                onClick={props.createFunction}
                disabled={props.disabled}
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
    return (
    <div id="canvas"></div>
    );
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
