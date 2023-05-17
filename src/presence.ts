import { EditableField } from "@fluid-experimental/tree2";
import { ShapeProxy } from "./schema";

export function removeUserFromPresenceArray({
    userId,
    shapeProxy,
}: {
    userId: string;
    shapeProxy: ShapeProxy;
}): void {
    const users = shapeProxy.users;
    for(let i = 0; i < users.length; i++) {
        if (users[i] === userId) {
            users.deleteNodes(i, 1);
            break;
        }
    }
}

export function addUserToPresenceArray({
    userId,
    shapeProxy,
}: {
    userId: string;
    shapeProxy: ShapeProxy;
}): void {
    const users = shapeProxy.users;
    for(const user of users) {
        if (user === userId) {
            return;
        }
    }
    users[users.length] = userId;
}

export function shouldShowPresence(shapeProxy: ShapeProxy, userId: string): boolean {
    for (const user of shapeProxy.users) {
        if (user !== userId) {
            return true;
        }
    }
    return false;
}

export function userIsInPresenceArray(shapeProxy: ShapeProxy, userId: string): boolean {
    for (const user of shapeProxy.users) {
        if (user === userId) {
            return true;
        }
    }
    return false;
}

export function clearPresence(userId: string, shapeTree: ShapeProxy[] & EditableField) {
    for (const shapeProxy of shapeTree) {
        removeUserFromPresenceArray({userId, shapeProxy});
    }
}