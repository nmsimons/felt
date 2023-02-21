import {
	brand,
	EditableTree,
	rootFieldKey,
	SchemaData,
	ValueSchema,
} from "@fluid-internal/tree";
import { fieldSchema } from "@fluid-internal/tree/dist/core";
import { FieldKinds, namedTreeSchema } from "@fluid-internal/tree/dist/feature-libraries";

export const stringSchema = namedTreeSchema({
	name: brand("String"),
	value: ValueSchema.String,
});

export const numberSchema = namedTreeSchema({
	name: brand("number"),
	value: ValueSchema.Number,
});

export const booleanSchema = namedTreeSchema({
	name: brand("boolean"),
	value: ValueSchema.Boolean,
});

export const locationSchema = namedTreeSchema({
    name: brand("location"),
	localFields: {
        x: fieldSchema(FieldKinds.value, [numberSchema.name]),
		y: fieldSchema(FieldKinds.value, [numberSchema.name]),
	},
})

export const shapeSchema = namedTreeSchema({
	name: brand("shape"),
	localFields: {
        id: fieldSchema(FieldKinds.value, [stringSchema.name]),
        location: fieldSchema(FieldKinds.value, [locationSchema.name]),
        color: fieldSchema(FieldKinds.value, [stringSchema.name]),
        z: fieldSchema(FieldKinds.value, [numberSchema.name]),
        shape: fieldSchema(FieldKinds.value, [stringSchema.name]),
        deleted: fieldSchema(FieldKinds.value, [booleanSchema.name]),
	},
});

export type LocationProxy = EditableTree & {
    x: number,
    y: number,
}

export type ShapeProxy = EditableTree & {
	id: string,
    location: LocationProxy,
    color: string,
    z: number,
    shape: string,
    deleted: boolean,
};

export const rootAppStateSchema = fieldSchema(FieldKinds.sequence, [shapeSchema.name]);

export const appSchemaData: SchemaData = {
	treeSchema: new Map([
		[stringSchema.name, stringSchema],
        [booleanSchema.name, booleanSchema],
		[numberSchema.name, numberSchema],
		[shapeSchema.name, shapeSchema],
        [locationSchema.name, locationSchema],
	]),
	globalFieldSchema: new Map([[rootFieldKey, rootAppStateSchema]]),
};