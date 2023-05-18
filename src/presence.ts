import { Felt, Shape } from "./schema";

export function removeUserFromPresenceArray({
    userId,
    shape,
}: {
    userId: string;
    shape: Shape;
}): void {
    const users = shape.users;
    for(let i = 0; i < users.length; i++) {
        if (users[i] === userId) {
            users.deleteNodes(i, 1);
            break;
        }
    }
}

export function addUserToPresenceArray({
    userId,
    shape,
}: {
    userId: string;
    shape: Shape;
}): void {
    const users = shape.users;
    for(const user of users) {
        if (user === userId) {
            return;
        }
    }
    users[users.length] = userId;
}

export function shouldShowPresence(shapeProxy: Shape, userId: string): boolean {
    for (const user of shapeProxy.users) {
        if (user !== userId) {
            return true;
        }
    }
    return false;
}

export function userIsInPresenceArray(shape: Shape, userId: string): boolean {
    for (const user of shape.users) {
        if (user === userId) {
            return true;
        }
    }
    return false;
}

export function clearPresence(userId: string, shapeTree: Felt) {
    for (const shape of shapeTree.shapes) {
        removeUserFromPresenceArray({userId, shape});
    }
}