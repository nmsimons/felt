export enum ShapeType {
    Circle = 'CIRCLE',
    Square = 'SQUARE',
    Triangle = 'TRIANGLE',
    Rectangle = 'RECTANGLE',
}

export enum Color {
    Red = '0xFF0000',
    Green = '0x009A44',
    Blue = '0x0000FF',
    Orange = '0xFF7F00',
    Purple = '0x800080',
}

export function getNextColor(current: Color) {
    return Object.values(Color)[
        (Object.values(Color).indexOf(current) + 1) % Object.values(Color).length
    ];
}

export function getNextShape(current: ShapeType) {
    return Object.values(ShapeType)[
        (Object.values(ShapeType).indexOf(current) + 1) % Object.values(ShapeType).length
    ];
}

export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}
