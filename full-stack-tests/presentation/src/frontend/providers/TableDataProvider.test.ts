/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { initialize, terminate } from "../../IntegrationTests";
import { Id64 } from "@bentley/bentleyjs-core";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, InstanceKey, ContentSpecificationTypes, Ruleset, RuleTypes } from "@bentley/presentation-common";
import { PresentationTableDataProvider } from "@bentley/presentation-components";
import { Presentation } from "@bentley/presentation-frontend";
import { SortDirection } from "@bentley/ui-core";

const RULESET: Ruleset = {
  id: "localization test",
  rules: [{
    ruleType: RuleTypes.Content,
    specifications: [{
      specType: ContentSpecificationTypes.SelectedNodeInstances,
    }],
  }],
};

interface MeaningfulInstances {
  repositoryModel: ModelProps;
  dictionaryModel: ModelProps;
  physicalModel: ModelProps;
}
const createMeaningfulInstances = async (imodel: IModelConnection): Promise<MeaningfulInstances> => {
  return {
    repositoryModel: (await imodel.models.queryProps({ from: "bis.RepositoryModel" }))[0],
    dictionaryModel: (await imodel.models.queryProps({ from: "bis.DictionaryModel", wantPrivate: true }))[0],
    physicalModel: (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0],
  };
};

describe("TableDataProvider", async () => {

  let imodel: IModelConnection;
  let instances: MeaningfulInstances;
  let provider: PresentationTableDataProvider;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
    instances = await createMeaningfulInstances(imodel);
  });

  beforeEach(async () => {
    provider = new PresentationTableDataProvider({ imodel, ruleset: RULESET, pageSize: 10 });
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  describe("getColumns", () => {

    it("returns columns for a single instance", async () => {
      provider.keys = new KeySet([instances.physicalModel]);
      const columns = await provider.getColumns();
      expect(columns).to.matchSnapshot();
    });

    it("returns columns for multiple instances", async () => {
      provider.keys = new KeySet([instances.repositoryModel, instances.physicalModel]);
      const columns = await provider.getColumns();
      expect(columns).to.matchSnapshot();
    });

  });

  describe("getRowsCount", () => {

    it("returns total number of instances when less than page size", async () => {
      provider.keys = new KeySet([instances.repositoryModel, instances.physicalModel]);
      const count = await provider.getRowsCount();
      expect(count).to.eq(2);
    });

    it("returns total number of instances when more than page size", async () => {
      const keys = await imodel.elements.queryProps({ from: "bis.PhysicalElement", limit: 20 });
      provider.keys = new KeySet(keys);
      const count = await provider.getRowsCount();
      expect(count).to.eq(20);
    });

  });

  describe("getRow", () => {

    it("returns first row", async () => {
      provider.keys = new KeySet([instances.physicalModel]);
      const row = await provider.getRow(0);
      expect(row).to.matchSnapshot();
    });

    it("returns undefined when requesting row with invalid index", async () => {
      provider.keys = new KeySet([instances.physicalModel]);
      const row = await provider.getRow(1);
      expect(row).to.be.undefined;
    });

  });

  it("requests backend only once to get first page", async () => {
    const getContentAndContentSizeSpy = sinon.spy(Presentation.presentation.rpcRequestsHandler, "getContentAndSize");
    provider.keys = new KeySet([instances.physicalModel]);
    provider.pagingSize = 10;

    // request count and first page
    const count = await provider.getRowsCount();
    const row = await provider.getRow(0);

    expect(count).to.not.eq(0);
    expect(row).to.not.be.undefined;
    expect(getContentAndContentSizeSpy.calledOnce).to.be.true;
  });

  describe("sorting", () => {

    it("sorts instances ascending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.dictionaryModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Ascending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map(async (index: number) => provider.getRow(index)));
      // expected order:
      // BisCore.DictionaryModel (dictionary model)
      // DgnV8Bridge (repository model)
      // Properties_60InstancesWithUrl2 (physical model)
      expect(rows).to.matchSnapshot();
    });

    it("sorts instances descending", async () => {
      // provide keys so that instances by default aren't sorted in either way
      provider.keys = new KeySet([instances.physicalModel, instances.dictionaryModel, instances.repositoryModel]);
      await provider.sort(0, SortDirection.Descending); // sort by display label (column index = 0)
      const rows = await Promise.all([0, 1, 2].map(async (index: number) => provider.getRow(index)));
      // expected order:
      // Properties_60InstancesWithUrl2 (physical model)
      // DgnV8Bridge (repository model)
      // BisCore.DictionaryModel (dictionary model)
      expect(rows).to.matchSnapshot();
    });

  });

  describe("filtering", () => {

    it("filters instances", async () => {
      provider.keys = new KeySet([instances.physicalModel, instances.dictionaryModel, instances.repositoryModel]);
      const columns = await provider.getColumns();
      provider.filterExpression = `${columns[0].key} = "Properties_60InstancesWithUrl2"`;
      expect(await provider.getRowsCount()).to.eq(1);
      const row = await provider.getRow(0);
      const rowKey = InstanceKey.fromJSON(JSON.parse(row!.key));
      expect(rowKey.id).to.eq(Id64.fromString(instances.physicalModel.id!));
    });

  });

});
