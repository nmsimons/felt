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

// semi optimal tidy of the presence array to remove
// stray data from previous sessions. This is currently run
// fairly frequently but really only needs to run when a session is
// started.
export function flushPresenceArray(users: string[] & EditableField): void {

}

export function shouldShowPresence(shapeProxy: ShapeProxy, audience: IAzureAudience): boolean {
    const id = audience.getMyself()?.userId;
    for (const user of shapeProxy.users) {
        if (user !== id) {
            return true;
        }
    }
    return false;
}

export function currentUserIsInPresenceArray(shapeProxy: ShapeProxy, audience: IAzureAudience): boolean {
    const id = audience.getMyself()?.userId;
    for (const user of shapeProxy.users) {
        if (user === id) {
            return true;
        }
    }
    return false;
}