import { Application, Container, Sprite, Text } from 'pixi.js';
import { getFluidData } from '../fluid';

export class FluidText extends Container {
    app: Application;
    // private _value: string = "";
    private _text: Text;

    constructor(app: Application) {
        super();
        this.app = app;

        this._text = new Text('Basic text in pixi');
        this._text.x = 50;
        this._text.y = 100;
    }

    public get text(): string {
        return this._text.text;
    }

    public set text(s: string) {
        this._text.text = s;
    }
}
