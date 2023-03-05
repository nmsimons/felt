import { IDirectory } from "fluid-framework";

export const removeUserFromPresenceArray = (
    userId: string,
    shapeDirectory: IDirectory
    ): void => {
    const users = shapeDirectory.get("users") as string[];
    const i = users.indexOf(userId)
    if( i > -1) {
        users.splice(i, 1);
    }
    shapeDirectory.set("users", users);
}

export const addUserToPresenceArray = (
    userId: string,
    shapeDirectory: IDirectory
): void => {
    const users = shapeDirectory.get("users") as string[];
    if (userIsInPresenceArray(users, userId)) return;
    users.push(userId);
    shapeDirectory.set("users", users);
}

export const shouldShowPresence = (users: string[], userId: string): boolean => {
    return (!userIsInPresenceArray(users, userId) && users.length > 0 || users.length > 1);
}

export const userIsInPresenceArray = (users: string[], userId: string): boolean => {
    return (users.indexOf(userId) > -1);
}

export const clearPresence = (userId: string, shapeRootDirectory: IDirectory) => {
    for (const shape of shapeRootDirectory.subdirectories()) {
        removeUserFromPresenceArray( userId, shape[1] );
    }
}