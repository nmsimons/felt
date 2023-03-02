import { EditableField } from "@fluid-internal/tree";
import { IAzureAudience } from "@fluidframework/azure-client";
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
            console.log("REMOVED", userId, "FROM", shapeProxy.id)
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
            console.log(userId, "ALREADY IN", shapeProxy.id)
            return;
        }
    }
    users[users.length] = userId;
    console.log("ADDED", userId, "TO", shapeProxy.id)
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