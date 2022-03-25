
import * as PIXI from 'pixi.js';

export function CreateShape(app: PIXI.Application): PIXI.DisplayObject {       
    
    var dragging: any;
    var data: any;

    const sprite = new PIXI.Sprite(
        app.loader.resources['assets/willow.png'].texture
    );
    sprite.x = 100;
    sprite.y = 100;
    sprite.anchor.set(0.5);

    sprite.interactive = true;
    sprite.buttonMode = true;

    // Pointers normalize touch and mouse
    sprite
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove);


    // Alternatively, use the mouse & touch events:
    // sprite.on('click', onClick); // mouse-only
    // sprite.on('tap', onClick); // touch-only

    app.stage.addChild(sprite);

    function onClick() {
        sprite.scale.x *= 1.25;
        sprite.scale.y *= 1.25;
    }

    function onDragStart(event: any) {
        // store a reference to the data
        // the reason for this is because of multitouch
        // we want to track the movement of this particular touch
        data = event.data;
        sprite.alpha = 0.5;
        dragging = true;
    }
    
    function onDragEnd() {
        sprite.alpha = 1;
        dragging = false;
        // set the interaction data to null
        data = null;
    }
    
    function onDragMove() {
        if (dragging) {
            const newPosition = data.getLocalPosition(sprite.parent);
            sprite.x = newPosition.x;
            sprite.y = newPosition.y;
        }
    }

    return sprite;
}



