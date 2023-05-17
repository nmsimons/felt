import {
	brand,
	EditableTree,
	rootFieldKey,
	SchemaData,
	ValueSchema,
	fieldSchema,
	EditableField,
	FieldKinds,
	namedTreeSchema
} from "@fluid-experimental/tree2";

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

export const positionSchema = namedTreeSchema({
	name: brand("position"),
	localFields: {
		x: fieldSchema(FieldKinds.value, [numberSchema.name]),
        y: fieldSchema(FieldKinds.value, [numberSchema.name]),
	}
})

export const shapeSchema = namedTreeSchema({
	name: brand("shape"),
	localFields: {
        id: fieldSchema(FieldKinds.value, [stringSchema.name]),
        position: fieldSchema(FieldKinds.value, [positionSchema.name]),
        y: fieldSchema(FieldKinds.value, [numberSchema.name]),
        color: fieldSchema(FieldKinds.value, [stringSchema.name]),
        z: fieldSchema(FieldKinds.value, [numberSchema.name]),
        shape: fieldSchema(FieldKinds.value, [stringSchema.name]),
        users: fieldSchema(FieldKinds.sequence, [stringSchema.name]),
	},
});

export type PositionProxy = EditableTree & {
	x: number,
    y: number,
}

export type ShapeProxy = EditableTree & {
	id: string,
    position: PositionProxy,
    y: number,
    color: string,
    z: number,
    shape: string,
    users: string[] & EditableField,
};

export const rootAppStateSchema = fieldSchema(FieldKinds.sequence, [shapeSchema.name]);

export const appSchemaData: SchemaData = {
	treeSchema: new Map([
		[stringSchema.name, stringSchema],
        [booleanSchema.name, booleanSchema],
		[numberSchema.name, numberSchema],
		[shapeSchema.name, shapeSchema],
		[positionSchema.name, positionSchema]
	]),
	globalFieldSchema: new Map([[rootFieldKey, rootAppStateSchema]]),
};