import { Sprite } from 'pixi.js';

export interface FeltSprite {
    width: number;
    height: number;
    x: number;
    y: number;
}

export const SpriteToObject = (sprite: Sprite): FeltSprite => {
    return sprite;
};
