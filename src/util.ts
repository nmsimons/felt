export enum Shape {
    Circle = 'CIRCLE',
    Square = 'SQUARE',
    Triangle = 'TRIANGLE',
    Rectangle = 'RECTANGLE',
}

export enum Color {
    '0xFF0000' = 'RED',
    '0x009A44' = 'GREEN',
    '0x0000FF' = 'BLUE',
    '0xFF7F00' = 'ORANGE',
    '0x800080' = 'PURPLE',
}

export function getDeterministicShape(index: number): Shape {
    return Object.values(Shape)[index % Object.values(Shape).length];
}

export function getNextColor(current: number) {
    const currentIndex = Object.keys(Color).indexOf(getColorAsString(current));
    return getDeterministicColor(currentIndex + 1);
}

export function getColorAsString(color: number) {
    return color.toString(16).padStart(6, '0').toUpperCase().padStart(8, '0x');
}

export function getDeterministicColor(index: number) {
    return Number(Object.keys(Color)[index % Object.keys(Color).length]);
}
