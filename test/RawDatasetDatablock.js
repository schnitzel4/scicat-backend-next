var chai = require("chai");
var should = chai.should();
var chaiHttp = require("chai-http");
var request = require("supertest");
var utils = require("./LoginUtils");

const { TestData } = require("./TestData");

chai.use(chaiHttp);

const app = "http://localhost:3000";

describe("RawDatasetDatablock: Test Datablocks and their relation to raw Datasets", () => {
  var accessTokenIngestor = null;
  var accessTokenArchiveManager = null;

  var datasetPid = null;
  var datablockId = null;
  var datablockId2 = null;

  beforeEach((done) => {
    utils.getToken(
      app,
      {
        username: "ingestor",
        password: "aman",
      },
      (tokenVal) => {
        accessTokenIngestor = tokenVal;
        utils.getToken(
          app,
          {
            username: "archiveManager",
            password: "aman",
          },
          (tokenVal) => {
            accessTokenArchiveManager = tokenVal;
            done();
          },
        );
      },
    );
  });

  it("adds a new raw dataset", async () => {
    return request(app)
      .post("/api/v3/Datasets")
      .send(testraw)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenIngestor}` })
      .expect(200)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.body.should.have.property("owner").and.be.string;
        res.body.should.have.property("type").and.equal("raw");
        res.body.should.have.property("pid").and.be.string;
        // store link to this dataset in datablocks
        datasetPid = encodeURIComponent(res.body["pid"]);
      });
  });

  it("adds a new datablock", () => {
    return request(app)
      .post(`/api/v3/datasets/${datasetPid}/Datablocks`)
      .send(TestData.DataBlockCorrect)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenArchiveManager}` })
      .expect(201)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.body.should.have
          .property("size")
          .and.equal(TestData.OrigDataBlockCorrect.size);
        res.body.should.have.property("id").and.be.string;
        datablockId = encodeURIComponent(res.body["id"]);
      });
  });

  it("adds the same datablock again which should fail because it is already stored", async () => {
    return request(app)
      .post(`/api/v3/datasets/${datasetPid}/Datablocks`)
      .send(TestData.DataBlockCorrect)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenArchiveManager}` })
      .expect(500)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.should.have.property("error");
      });
  });

  it("adds a new datablock which should fail because wrong functional account", async () => {
    return request(app)
      .post(`/api/v3/datasets/${datasetPid}/Datablocks`)
      .send(TestData.DataBlockCorrect)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenIngestor}` })
      .expect(401)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.should.have.property("error");
      });
  });

  it("adds a second datablock for same dataset", async () => {
    let testdata = TestData.DataBlockCorrect;
    testdata.archiveId = "some-other-id-that-is-different";
    return request(app)
      .post(`/api/v3/datasets/${datasetPid}/Datablocks`)
      .send(testdata)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenArchiveManager}` })
      .expect(201)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.body.should.have.property("size");
        res.body.should.have.property("id").and.be.string;
        datablockId2 = encodeURIComponent(res.body["id"]);
      });
  });

  it("Should fetch all datablocks belonging to the new dataset", async () => {
    return request(app)
      .get("/api/v3/Datasets/" + pid + "/datablocks")
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenIngestor}` })
      .expect(200)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.body.should.be.instanceof(Array).and.to.have.length(2);
      });
  });

  it("should fetch one dataset including related data", async () => {
    var limits = {
      skip: 0,
      limit: 10,
    };
    var filter = {
      where: {
        pid: datasetPid,
      },
      include: [
        {
          relation: "datablocks",
        },
      ],
    };

    return request(app)
      .get(
        "/api/v3/Datasets/findOne?filter=" +
          encodeURIComponent(JSON.stringify(filter)) +
          "&limits=" +
          encodeURIComponent(JSON.stringify(limits)),
      )
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenIngestor}` })
      .expect(200)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.body["pid"].should.be.equal(datasetPid);
        res.body.datablocks.should.be.instanceof(Array).and.to.have.length(2);
        res.body.datablocks[0].should.have
          .property("dataFileList")
          .and.be.instanceof(Array)
          .and.to.have.length(
            TestData.OrigDataBlockCorrect.dataFileList.length,
          );
      });
  });

  it("Should fetch some filenames from the new dataset", async () => {
    var fields = {
      datasetId: datasetPid,
      filenameExp: "B410",
    };
    var limits = {
      skip: 0,
      limit: 20,
    };
    return request(app)
      .get(
        "/api/v3/OrigDatablocks/findFilesByName?fields=" +
          encodeURIComponent(JSON.stringify(fields)) +
          "&limits=" +
          encodeURIComponent(JSON.stringify(limits)),
      )
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenIngestor}` })
      .expect(200)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.body.should.be.instanceof(Array).and.to.have.lengthOf.above(0);
      });
  });

  it("The size and numFiles fields in the dataset should be correctly updated", async () => {
    return request(app)
      .get("/api/v3/Datasets/" + datasetPid)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenIngestor}` })
      .expect(200)
      .expect("Content-Type", /json/)
      .then((res) => {
        res.body.should.have
          .property("size")
          .and.equal(TestData.OrigDataBlockCorrect.size * 2);
        res.body.should.have
          .property("packedSize")
          .and.equal(TestData.DataBlockCorrect.size * 2);
        res.body.should.have
          .property("numberOfFiles")
          .and.equal(TestData.OrigDataBlockCorrect.numberOfFiles * 2);
        res.body.should.have
          .property("numberOfFilesArchived")
          .and.equal(TestData.DataBlockCorrect.numberOfFiles * 2);
      });
  });

  it("should delete first datablock", async () => {
    return request(app)
      .delete(`/api/v3/datasets/${datasetId}/Datablocks/${datablockId}`)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenArchiveManager}` })
      .expect(200)
      .expect("Content-Type", /json/);
  });

  it("should delete second datablock", async () => {
    return request(app)
      .delete(`/api/v3/datasets/${datasetId}/Datablocks/${datablockId2}`)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenArchiveManager}` })
      .expect(200)
      .expect("Content-Type", /json/);
  });

  it("should delete the newly created dataset", async () => {
    return request(app)
      .delete("/api/v3/Datasets/" + pid)
      .set("Accept", "application/json")
      .set({ Authorization: `Bearer ${accessTokenArchiveManager}` })
      .expect(200)
      .expect("Content-Type", /json/);
  });
});