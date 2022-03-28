import {
    AzureFunctionTokenProvider,
    AzureClient,
    AzureConnectionConfig,
    AzureContainerServices,
    LOCAL_MODE_TENANT_ID,
} from '@fluidframework/azure-client';
import {
    generateTestUser,
    InsecureTokenProvider,
} from '@fluidframework/test-client-utils';
import {
    ContainerSchema,
    IFluidContainer,
    SharedDirectory,
    SharedMap,
} from 'fluid-framework';
import { Application, Container, Sprite } from 'pixi.js';
import { SpriteToObject } from './wrappers';

export interface ICustomUserDetails {
    gender: string;
    email: string;
}

const userDetails: ICustomUserDetails = {
    gender: 'female',
    email: 'xyz@microsoft.com',
};

// Define the server we will be using and initialize Fluid
const useAzure = process.env.FLUID_CLIENT === 'azure';

const user = generateTestUser();

const azureUser = {
    userId: user.id,
    userName: user.name,
    additionalDetails: userDetails,
};

const connectionConfig: AzureConnectionConfig = useAzure
    ? {
          tenantId: '',
          tokenProvider: new AzureFunctionTokenProvider('', azureUser),
          orderer: '',
          storage: '',
      }
    : {
          tenantId: LOCAL_MODE_TENANT_ID,
          tokenProvider: new InsecureTokenProvider('fooBar', user),
          orderer: 'http://localhost:7070',
          storage: 'http://localhost:7070',
      };

// Define the schema of our Container.
// This includes the DataObjects we support and any initial DataObjects we want created
// when the container is first created.
const containerSchema: ContainerSchema = {
    initialObjects: {
        /* [id]: DataObject */
        root: SharedDirectory,
        shapes: SharedDirectory,
    },
    dynamicObjectTypes: [SharedDirectory, SharedMap],
};

const clientProps = {
    connection: connectionConfig,
};

async function initializeNewContainer(
    container: IFluidContainer
): Promise<void> {
    const sprites: Sprite[] = [];
    const root = container.initialObjects.root as SharedDirectory;
    const shapes = container.initialObjects.shapes as SharedDirectory;
    let i = 0;
    for (const s of sprites) {
        shapes.set(i.toString(), SpriteToObject(s));
        i++;
    }

    root.set('test', 'test-string');
}

const client = new AzureClient(clientProps);

export const getFluidData = async (): Promise<{
    container: IFluidContainer;
    services: AzureContainerServices;
}> => {
    const clientProps = {
        connection: connectionConfig,
    };
    // const client = new AzureClient(clientProps);
    let container: IFluidContainer;
    let services: AzureContainerServices;
    let id: string;

    // Get or create the document depending if we are running through the create new flow
    const createNew = location.hash.length === 0;
    if (createNew) {
        // The client will create a new detached container using the schema
        // A detached container will enable the app to modify the container before attaching it to the client
        ({ container, services } = await client.createContainer(
            containerSchema
        ));
        // Initialize our models so they are ready for use with our controllers
        await initializeNewContainer(container);

        // If the app is in a `createNew` state, and the container is detached, we attach the container.
        // This uploads the container to the service and connects to the collaboration session.
        id = await container.attach();
        // The newly attached container is given a unique ID that can be used to access the container in another session
        location.hash = id;
    } else {
        id = location.hash.substring(1);
        // Use the unique container ID to fetch the container created earlier.  It will already be connected to the
        // collaboration session.
        ({ container, services } = await client.getContainer(
            id,
            containerSchema
        ));
    }

    document.title = id;

    return { container, services };

    // TODO 2: Get the container from the Fluid service.
    // TODO 3: Return the Fluid timestamp object.
};
