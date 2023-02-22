import React from 'react';
import { IAzureAudience } from '@fluidframework/azure-client';
import Icon from '@mdi/react';
import { mdiCircle, mdiSquare, mdiTriangle, mdiRectangle, mdiShape } from '@mdi/js';
import { mdiCloseThick, mdiEraser } from '@mdi/js';
import { mdiArrangeBringForward } from '@mdi/js';
import { mdiInformationOutline } from '@mdi/js';
import { Color, Shape as S } from './util';
import { Shapes, shapeLimit } from './index';

// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
    audience: IAzureAudience;
    createShape: any;
    createLotsOfShapes: any;
    changeColor: any;
    deleteShape: any;
    deleteAllShapes: any;
    bringToFront: any;
    toggleSignals: any;
    signals: () => boolean;
    selectionManager: any;
    localShapes: Shapes;
}): JSX.Element {
    const keyDownHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'Delete': {
                props.deleteShape();
            }
            default: {
            }
        }
    };
    React.useEffect(() => {
        window.addEventListener('keydown', (event) => keyDownHandler(event));
    }, []);

    const [infopaneIsOpen, toggleInfopane] = React.useState(false);

    const showInfopane = () => {
        toggleInfopane(true);
    };

    const hideInfopane = () => {
        toggleInfopane(false);
    };

    return (
        <div>
            <Toolbar {...props} showInfopane={showInfopane} />
            <Canvas />
            <StatusBar {...props} />
            <Infopane isOpen={infopaneIsOpen} close={hideInfopane} />
        </div>
    );
}

// eslint-disable-next-line react/prop-types
export function Toolbar(props: {
    createShape: any;
    createLotsOfShapes: any;
    changeColor: any;
    deleteShape: any;
    deleteAllShapes:any;
    bringToFront: any;
    audience: IAzureAudience;
    showInfopane: any;
    selectionManager: any;
    localShapes: Shapes;
}) {
    const shapeButtonColor = 'black';

    React.useEffect(() => {
        props.selectionManager.onChanged(() => {
            getSelected(props.selectionManager.selected);
        });
    }, []);

    React.useEffect(() => {
        props.localShapes.onChanged(() => {
            getMaxReached(props.localShapes.maxReached);
        });
    }, []);

    const [selected, getSelected] = React.useState(props.selectionManager.selected);

    const [maxReached, getMaxReached] = React.useState(props.localShapes.maxReached);

    return (
        <div className="level is-light mb-3 mt-3">
            <div className="level-left">
                <div className="level-item">
                    <div className="field has-addons">
                        <ShapeButton
                            icon={mdiCircle}
                            title="Circle"
                            color={shapeButtonColor}
                            disabled={maxReached}
                            function={() => props.createShape(S.Circle, Color.Red)}
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Square"
                            color={shapeButtonColor}
                            disabled={maxReached}
                            function={() => props.createShape(S.Square, Color.Blue)}
                        />
                        <ShapeButton
                            icon={mdiTriangle}
                            title="Triangle"
                            color={shapeButtonColor}
                            disabled={maxReached}
                            function={() =>
                                props.createShape(S.Triangle, Color.Orange)
                            }
                        />
                        <ShapeButton
                            icon={mdiRectangle}
                            title="Rectangle"
                            color={shapeButtonColor}
                            disabled={maxReached}
                            function={() =>
                                props.createShape(S.Rectangle, Color.Purple)
                            }
                        />
                        <ShapeButton
                            icon={mdiShape}
                            title="Lots of shapes"
                            color={shapeButtonColor}
                            disabled={maxReached}
                            function={() => props.createLotsOfShapes(100)}
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
                            function={() => props.changeColor(Color.Red)}
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Green"
                            color="Green"
                            disabled={!selected}
                            function={() => props.changeColor(Color.Green)}
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Blue"
                            color="Blue"
                            disabled={!selected}
                            function={() => props.changeColor(Color.Blue)}
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Orange"
                            color="Orange"
                            disabled={!selected}
                            function={() => props.changeColor(Color.Orange)}
                        />
                        <ShapeButton
                            icon={mdiSquare}
                            title="Purple"
                            color="Purple"
                            disabled={!selected}
                            function={() => props.changeColor(Color.Purple)}
                        />
                    </div>
                </div>
                <div className="level-item">
                    <div className="field has-addons">
                        <ShapeButton
                            icon={mdiArrangeBringForward}
                            title="Bring to front"
                            color={shapeButtonColor}
                            disabled={!selected}
                            function={() => props.bringToFront()}
                        />
                        <ShapeButton
                            icon={mdiCloseThick}
                            title="Delete"
                            color={shapeButtonColor}
                            disabled={!selected}
                            function={() => props.deleteShape()}
                        />
                    </div>
                </div>
                <div className="level-item">
                    <div className="field has-addons">
                        <ShapeButton
                            icon={mdiEraser}
                            title="Clear all"
                            color={shapeButtonColor}
                            disabled={false}
                            function={() => props.deleteAllShapes()}
                        />
                    </div>
                </div>
            </div>
            <div className="level-right">
                <div className="level-item">
                    <div className="field has-addons">
                        <ShapeButton
                            icon={mdiInformationOutline}
                            title="Info"
                            color={shapeButtonColor}
                            disabled={false}
                            function={() => props.showInfopane()}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function LabelIcon(props: { icon: any }) {
    return <Icon className="mr-1" path={props.icon} size={1} color="Gray" />;
}

export function ShapeButton(props: {
    icon: any;
    title: string;
    color: string;
    function: any;
    disabled: boolean;
}) {
    return (
        <p className="control">
            <button
                className="button is-normal is-light"
                onClick={props.function}
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
    return <div id="canvas"></div>;
}

export function StatusBar(props: {
    audience: IAzureAudience;
    toggleSignals: any;
    signals: () => boolean;
    localShapes: Shapes;
}) {
    const [, setChecked] = React.useState(props.signals());

    const handleChange = () => {
        props.toggleSignals();
        setChecked(props.signals());
    };

    const [fluidCount, getFluidCount] = React.useState(props.localShapes.size);

    React.useEffect(() => {
        props.localShapes.onChanged(() => {
            getFluidCount(props.localShapes.size);
        });
    }, []);

    return (
        <div className="level mb-0 mt-0">
            <div className="level-left">
                <div className="level-item">
                    <div className="field mt-0 mb-0">
                        <input
                            id="switchRoundedInfo"
                            type="checkbox"
                            name="switchRoundedInfo"
                            className="switch is-rounded is-info"
                            checked={props.signals()}
                            onChange={handleChange}
                        />
                        <label className="mb-3 mt-0" htmlFor="switchRoundedInfo">
                            Use signals
                        </label>
                    </div>
                </div>
            </div>
            <div className="level-right">
                <div className="level-item mb-2 mt-0">
                    <p>Shapes: {fluidCount}</p>
                </div>
                <div className="level-item mb-2 mt-0">
                    <Audience audience={props.audience} />
                </div>
            </div>
        </div>
    );
}

export function Audience(props: { audience: IAzureAudience }): JSX.Element {
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

    return <div>Current co-creators: {members.length - 1}</div>;
}

export function Infopane(props: { isOpen: boolean; close: any }): JSX.Element {
    let isActive: string = '';

    if (props.isOpen) {
        isActive = ' is-active';
    } else {
        isActive = '';
    }

    return (
        <div id="infopane" className={'modal' + isActive}>
            <div onClick={props.close} className="modal-background"></div>
            <div className="modal-content is-light">
                <div className="message is-info">
                    <div className="message-header">
                        <p>Fluid Framework demo app</p>
                        <button
                            onClick={props.close}
                            className="delete"
                            aria-label="delete"
                        ></button>
                    </div>
                    <div className="message-body">
                        To see Fluid in action, share the URL including the goo at
                        the end.
                    </div>
                </div>
            </div>
        </div>
    );
}
