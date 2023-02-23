import { EditableField } from "@fluid-internal/tree";
import { ShapeProxy } from "./schema";
import { Shapes } from "./shapes";

export function removeUserFromPresenceArray({
    shapeId,
    userId,
    localShapes
}: {
    shapeId: string;
    userId: string;
    localShapes: Shapes;
}): void {
    const users = localShapes.get(shapeId)?.shapeProxy.users;
    if (users === undefined) { return; }
    for(let i = 0; i < users.length; i++) {
        if (users[i] === userId) {
            users.deleteNodes(i);
            break;
        }
    }
}

export function addUserToPresenceArray({
    shapeId,
    userId,
    localShapes
}: {
    shapeId: string;
    userId: string;
    localShapes: Shapes;
}): void {
    const users = localShapes.get(shapeId)?.shapeProxy.users;
    if (users === undefined) { return; }
    for(let i = 0; i < users.length; i++) {
        if (users[i] === userId) {
            return;
        }
    }
    users[users.length] = userId;
}

// semi optimal tidy of the presence array to remove
// stray data from previous sessions. This is currently run
// fairly frequently but really only needs to run when a session is
// started.
export function flushPresenceArray(users: string[] & EditableField): void {

}

export function shouldShowPresence(shapeProxy: ShapeProxy, id: string | undefined): boolean {
    if (shapeProxy.users.length > 0) {
        for (const user of shapeProxy.users) {
            if (user !== id) {
                return true;
            }
        }
    }
    return false;
}