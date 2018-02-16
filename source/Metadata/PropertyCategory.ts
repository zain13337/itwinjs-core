/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaChild from "./SchemaChild";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaChildType } from "../ECObjects";
import { SchemaChildVisitor } from "../Interfaces";
import Schema from "./Schema";

export default class PropertyCategory extends SchemaChild {
  public readonly type: SchemaChildType.PropertyCategory;
  public priority: number;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.key.type = SchemaChildType.PropertyCategory;
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.priority) {
      if (typeof(jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The PropertyCategory ${this.name} has an invalid 'priority' attribute. It should be of type 'number'.`);
      this.priority = jsonObj.priority;
    }
  }

  public async accept(visitor: SchemaChildVisitor) {
    if (visitor.visitPropertyCategory)
      await visitor.visitPropertyCategory(this);
  }
}
