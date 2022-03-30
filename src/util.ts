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
    Orange = "0xFF7F00"
}

export function getDeterministicShape(index: number): Shape {
    return index % 4;
}

export function getRandomColor() {
    return Object.values(Color)[Math.floor(Math.random() * 4)];
}

export function getDeterministicColor(index: number) {
    return Object.values(Color)[index % 4];
}