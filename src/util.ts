import randomColor from 'randomcolor';

export enum Shape {
    Circle,
    Square,
    Triangle,
    Rectangle,
}

export enum Color {
    Red,
    Green,
    Blue,
    Orange,
    Random
}

export function getDeterministicInt(index: number, max: number): number {
    return index % max;
}

export function getDeterministicShape(index: number): Shape {
    return index % 4;
}

export function getRandomColor() {
    let color = randomColor({ format: 'hex' });

    console.log(`color: ${color}`);
    color = color.slice(1);
    const colorHex = parseInt(color, 16);
    return colorHex;
}

export function getColor(color: Color) {
    switch (color) {
        case Color.Red:
            return 0xFF0000;
        case Color.Green:
            return 0x00FF00;
        case Color.Blue:
            return 0x0000FF;
        case Color.Orange:
            return 0xFF7F00;
        default:
            return 0x888888;
    }
}
