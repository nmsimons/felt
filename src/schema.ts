import { FieldKinds, SchemaAware, SchemaBuilder, ValueSchema } from "@fluid-experimental/tree2";

const builder = new SchemaBuilder("felt app");

export const float64 = builder.primitive("number", ValueSchema.Number);
export const string = builder.primitive("string", ValueSchema.String);
export const boolean = builder.primitive("boolean", ValueSchema.Boolean);

export const positionSchema = builder.object("felt:part", {
	local: {
		x: SchemaBuilder.field(FieldKinds.value, float64),
        y: SchemaBuilder.field(FieldKinds.value, float64)
	}
})

export const shapeSchema = builder.object("felt:shape", {
	local: {
        id: SchemaBuilder.field(FieldKinds.value, string),
        position: SchemaBuilder.field(FieldKinds.value, positionSchema),
        color: SchemaBuilder.field(FieldKinds.value, string),
        z: SchemaBuilder.field(FieldKinds.value, float64),
        shapeType: SchemaBuilder.field(FieldKinds.value, string),
        users: SchemaBuilder.field(FieldKinds.sequence, string),
	},
});

export const feltSchema = builder.object("felt:felt", {
	local: {
		shapes: SchemaBuilder.field(FieldKinds.sequence, shapeSchema)
	}
})

export const rootField = SchemaBuilder.field(FieldKinds.value, feltSchema);

export const schema = builder.intoDocumentSchema(rootField);

export type Felt = SchemaAware.TypedNode<typeof feltSchema>;
export type Shape = SchemaAware.TypedNode<typeof shapeSchema>;
export type Position = SchemaAware.TypedNode<typeof positionSchema>;