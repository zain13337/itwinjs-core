/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, IModel } from "../IModel";
import { ColorDef } from "../Render";
import { ElementProps, Element, GeometricElement3d, InformationPartitionElement, DefinitionPartition, LinkPartition, Subject } from "../Element";
import { Models } from "../Model";
import { Category, SubCategory } from "../Category";
import { ClassRegistry } from "../ClassRegistry";
import { ModelSelector } from "../ViewDefinition";
import { Elements } from "../Elements";
import { IModelTestUtils } from "./IModelTestUtils";
import { BisCore } from "../BisCore";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id64";
import { SpatialViewDefinition, DisplayStyle3d } from "../ViewDefinition";
import { Point3d, Vector3d, RotMatrix } from "@bentley/geometry-core/lib/PointVector";

// First, register any schemas that will be used in the tests.
BisCore.registerSchema();

describe("iModel", () => {

  it("should open an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
  });

  it("should use schema to look up classes by name", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const { result: elementClass } = await BisCore.getClass(Element.name, imodel);
    const { result: categoryClass } = await BisCore.getClass(Category.name, imodel);
    assert.equal(elementClass!.name, "Element");
    assert.equal(categoryClass!.name, "Category");
  });
});

describe("Elements", async () => {

  it("should load a known element by Id from an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    const elements: Elements = imodel.elements;
    assert.exists(elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const { result: el } = await elements.getElement({ code: code1 });
    assert.exists(el);
    const { result: el2 } = await elements.getElement({ id: "0x34" });
    assert.exists(el2);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });
    const { result: bad } = await elements.getElement({ code: badCode });
    assert.isUndefined(bad);
    const { result: subCat } = await elements.getElement({ id: "0x2e" });
    assert.isTrue(subCat instanceof SubCategory);
    if (subCat) {
      assert.isTrue(subCat.appearance.color.rgba === 16777215);
      assert.isTrue(subCat.appearance.weight === 2);
      assert.isTrue(subCat.id.lo === 46);
      assert.isTrue(subCat.id.hi === 0);
      assert.isTrue(subCat.code.spec.lo === 30);
      assert.isTrue(subCat.code.spec.hi === 0);
      assert.isTrue(subCat.code.scope === "0X2D");
      assert.isTrue(subCat.code.value === "A-Z013-G-Legn");
    }

    /// Get the parent Category of the subcategory.
    const { result: cat } = await elements.getElement({ id: (subCat as SubCategory).getCategoryId() });
    assert.isTrue(cat instanceof Category);
    if (cat) {
      assert.isTrue(cat.id.lo === 45);
      assert.isTrue(cat.id.hi === 0);
      // assert.isTrue(cat.description === "Legends, symbols keys");
      assert.isTrue(cat.code.spec.lo === 22);
      assert.isTrue(cat.code.spec.hi === 0);
      assert.isTrue(cat.code.value === "A-Z013-G-Legn");
    }

    const { result: phys } = await elements.getElement({ id: "0x38", noGeometry: false });
    assert.isTrue(phys instanceof GeometricElement3d);
  });

  it("should have a valid root subject element", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    const { result: rootSubject } = await imodel.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject!.code.getValue().length, 1);
    const { result: subModel } = await rootSubject!.getSubModel();
    assert.isUndefined(subModel, "Root subject should not have a subModel");

    const childIds: Id64[] = await rootSubject!.queryChildren();
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const { result: childElement } = await imodel.elements.getElement({ id: childId });
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);
      if (!childElement)
        continue;
      assert.isTrue(!!childElement.parent);
      assert.isTrue(childElement.parent!.id.lo === rootSubject!.id.lo);
      if (childElement instanceof InformationPartitionElement) {
        const { result: childSubModel } = await childElement.getSubModel();
        assert.exists(childSubModel, "InformationPartitionElements should have a subModel");

        if ((childId.lo === 16) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof DefinitionPartition, "ChildId 0x00000010 should be a DefinitionPartition");
          assert.isTrue(childElement.code.value === "BisCore.DictionaryModel", "Definition Partition should have code value of BisCore.DictionaryModel");
        } else if ((childId.lo === 14) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof LinkPartition);
          assert.isTrue(childElement.code.value === "BisCore.RealityDataSources");
        } else if ((childId.lo === 17) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof LinkPartition, "ChildId 0x000000011 should be a LinkPartition");
          assert.isTrue(childElement.code.value === "Repository Links");
        }
      } else if (childElement instanceof Subject) {
        if ((childId.lo === 19) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof Subject);
          assert.isTrue(childElement.code.value === "DgnV8:mf3, A", "Subject should have code value of DgnV8:mf3, A");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8File === "mf3.dgn", "Subject should have jsonProperty Subject.Job.DgnV.V8File");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8RootModel === "A", "Subject should have jsonProperty Subject.Job.DgnV.V8RootModel");
        }
      }
    }
  });
});

describe("Models", async () => {

  it("should load a known model by Id from an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    const models: Models = imodel.models;
    assert.exists(models);
    const { result: model2 } = await models.getModel({ id: "0x1c" });
    assert.exists(model2);
    let { result: model } = await models.getModel({ id: "0x1" });
    assert.exists(model);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    ({ result: model } = await models.getModel({ code: code1 }));
    const { result: geomModel } = await ClassRegistry.getClass({ name: "PhysicalModel", schema: "BisCore" }, imodel);
    assert.exists(model);
    assert.isTrue(model instanceof geomModel!);
  });

});
describe("ElementId", () => {

  it("ElementId should construct properly", () => {
    const id1 = new Id64("0x123");
    assert.isTrue(id1.isValid(), "good");
    const badid = new Id64("0x000");
    assert.isNotTrue(badid.isValid(), "bad");
    const id2 = new Id64("badness");
    assert.isNotTrue(id2.isValid());
    const id3 = new Id64("0xtbadness");
    assert.isNotTrue(id3.isValid());
    const id4 = new Id64("0x1234567890abc");
    assert.isTrue(id4.isValid());
    assert.equal(id4.hi, 0x123);
    const i5 = "0x20000000001";
    const id5 = new Id64(i5);
    assert.equal(id5.hi, 0x2);
    assert.equal(id5.lo, 0x1);
    const o5 = id5.toString();
    assert.equal(o5, i5);
    const id6 = new Id64([2000000, 3000]);
    const v6 = id6.toString();
    const id7 = new Id64(v6);
    assert.isTrue(id6.equals(id7));

    const t1 = { a: id7 };
    const j7 = JSON.stringify(t1);
    const p1 = JSON.parse(j7);
    const i8 = new Id64(p1.a);
    assert(i8.equals(id7));
    assert.isTrue(i8.equals(id7));

    const id1A = new Id64("0x1");
    const id1B = new Id64(id1A);
    const id1C = new Id64("0x01");
    const id1D = new Id64([1, 0]);
    assert.isTrue(id1A.equals(id1B));
    assert.isTrue(id1A.equals(id1C));
    assert.isTrue(id1A.equals(id1D));
  });

  it("Model Selectors should hold models", async () => {
    const imodel1: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const props: ElementProps = {
      iModel: imodel1,
      classFullName: BisCore.name + "." + ModelSelector.name,
      model: new Id64([1, 1]),
      code: Code.createDefault(),
      id: new Id64(),
    };

    const modelObj = await ClassRegistry.createInstance(props);
    const selector1 = modelObj.result as ModelSelector;
    assert.exists(selector1);
    if (selector1) {
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 3]));
    }
  });

  it("ColorDef should compare properly", () => {
    const color1 = ColorDef.from(1, 2, 3, 0);
    const color2 = ColorDef.from(1, 2, 3, 0);
    const color3 = ColorDef.from(0xa, 2, 3, 0);
    const blue = ColorDef.blue();

    assert.isTrue(color1.equals(color2), "color1 should equal color2");
    assert.isNotTrue(color1.equals(blue), "color1 should not equal blue");

    const blueVal = blue.rgba;
    assert.equal(blueVal, 0xff0000);
    assert.isTrue(blue.equals(new ColorDef(blueVal)));

    const colors = color3.getColors();
    ColorDef.from(colors.r, colors.g, colors.b, 0x30, color3);
    assert.isTrue(color3.equals(ColorDef.from(0xa, 2, 3, 0x30)));
  });
});

describe("Query", () => {

  it("should produce an array of rows", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const { result: allrowsdata } = await imodel.executeQuery("SELECT * FROM " + Category.sqlName);
    assert.exists(allrowsdata);
    const rows: any = JSON.parse(allrowsdata!);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].eCInstanceId);
    assert.notEqual(rows[0].eCInstanceId, "");
  });
});

describe("Views", () => {
  it("there should be at least one view element", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const { result: jsonString } = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + SpatialViewDefinition.sqlName);
    assert.exists(jsonString, "Should find some views");
    const viewIdList: any[] = JSON.parse(jsonString!);
    for (const thisViewId of viewIdList!) {
      const { result: thisView } = await imodel.elements.getElement({ id: thisViewId.elementId });
      assert.isTrue(thisView instanceof SpatialViewDefinition, "Should be instance of SpatialViewDefinition");
      if (!thisView)
        continue;
      if (!(thisView instanceof SpatialViewDefinition))
        continue;
      assert.isTrue(thisView.code.value === "A Views - View 1", "Code value is A Views - View 1");
      assert.isTrue(thisView.getDisplayStyleId().lo === 0x36, "Display Style Id is 0x36");
      assert.isTrue(thisView.getCategorySelectorId().lo === 0x37, "Category Id is 0x37");
      assert.isFalse(thisView.cameraOn, "The camera is not turned on");
      assert.isTrue(thisView.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
      assert.isTrue(thisView.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
      assert.isTrue(thisView.rotation.isAlmostEqual(RotMatrix.identity), "View rotation is identity");
      assert.isTrue(thisView.jsonProperties.viewDetails.gridOrient === 0, "Grid orientation as expected");
      assert.isTrue(thisView.jsonProperties.viewDetails.gridSpaceX === 0.001, "GridSpaceX as expected");

      // get the display style element
      const { result: thisDisplayStyle } = await imodel.elements.getElement({ id: thisView.getDisplayStyleId() });
      assert.isTrue(thisDisplayStyle instanceof DisplayStyle3d, "The Display Style should be a DisplayStyle3d");
      if (!(thisDisplayStyle instanceof DisplayStyle3d))
        continue;
      const bgColorDef: ColorDef = thisDisplayStyle.getBackgroundColor();
      assert.isTrue(bgColorDef.rgba === 0, "The background as expected");
      const sceneBrightness: number = thisDisplayStyle.getSceneBrightness();
      assert.isTrue(sceneBrightness === 0)
    }
  });
});
