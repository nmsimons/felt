export enum Shape {
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
    return Object.values(Color)[(Object.values(Color).indexOf(current) + 1) % Object.values(Color).length];
}

export function getNextShape(current: Shape) {
    return Object.values(Shape)[(Object.values(Shape).indexOf(current) + 1) % Object.values(Shape).length];
}

export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}