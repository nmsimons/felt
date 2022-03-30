import randomColor from 'randomcolor';

export enum Shape {
    Circle,
    Square,
    Triangle,
    Rectangle,
    Random,
}

export function getDeterministicInt(index: number, max: number): number {
    return index % max;
}

export function getRandomColor() {
    let color = randomColor({ format: 'hex', luminosity: 'dark' });

    console.log(`color: ${color}`);
    color = color.slice(1);
    const colorHex = parseInt(color, 16);
    return colorHex;
}
