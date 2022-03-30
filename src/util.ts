import randomColor from 'randomcolor';

export enum Shape {
    Circle,
    Square,
    Triangle,
    Rectangle,
}

export enum Color {
    Red = "0xFF0000",
    Green = "0x00FF00",
    Blue = "0x0000FF",
    Orange = "0xFF7F00",
    Purple = "0x800080",
    Pink = "0xFFC0CB",
}

export function getDeterministicShape(index: number): Shape {
    return index % 4;
}

export function getRandomColor(current: number) {
    let color = current;

    while (color === current) {
        color = Number(Object.values(Color)[Math.floor(Math.random() * Object.values(Color).length)]);
    }

    return color;
}

export function getDeterministicColor(index: number) {
    return Number(Object.values(Color)[index % Object.values(Color).length]);
}