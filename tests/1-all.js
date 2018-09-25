const Promise = require("bluebird");
const test = require("ava");
const fs = require("fs");

const SyncDriveSheet = require("../index");
const googleJwt = fs.existsSync(`${__dirname}/../google-jwt.json`)
  ? require("../google-jwt")
  : null;

const spreadsheetId = process.env.SPREADSHEET_ID;
const idColumn = process.env.SPREADSHEET_COLUMN_ID || "rid";
const sheet = process.env.SPREADSHEET_NAME || "test_sync_driver_sheet";
const spreadsheetCredentials =
  process.env.SPEADSHEET_CREDENTIALS ||
  (process.env.SPEADSHEET_CREDENTIALS_CLIENT_EMAIL &&
  process.env.SPEADSHEET_CREDENTIALS_PRIVATE_KEY
    ? {
        client_email: process.env.SPEADSHEET_CREDENTIALS_CLIENT_EMAIL,
        private_key: process.env.SPEADSHEET_CREDENTIALS_PRIVATE_KEY.replace(
          /\\n/g,
          "\n"
        )
      }
    : null) ||
  googleJwt;

/**
 * @description : Initialize spreadsheet
 */
let spreadsheet = null;
test.before("Initialize spreadsheet", async () => {
  spreadsheet = new SyncDriveSheet({
    service_account_credentials: spreadsheetCredentials,
    spreadsheet: spreadsheetId,
    id_column: idColumn,
    sheet
  });
  if (!spreadsheet) throw new Error("Spreadsheet initialization failed");
});

/**
 * @description : I want to read and recover my sheet with normal mode
 */
test("I want to read and recover my sheet with normal mode", async t => {
  const result = await new Promise((resolve, reject) => {
    spreadsheet.read((err, res) => {
      if (err) return reject(err);
      return resolve(res);
    });
  });
  t.deepEqual(
    result,
    [
      {
        rid: "1",
        test_1: "I am test1 row 1",
        test_2: "I am test2 row 1",
        test_3: "I am test3 row 1"
      },
      {
        rid: "2",
        test_1: "I am test1 row 2",
        test_2: "I am test2 row 2",
        test_3: "I am test3 row 2"
      }
    ],
    "Invalid reponse"
  );
});

/**
 * @description : I want to read and recover my sheet with async/await mode
 */
let resultRead = null;
test("I want to read and recover my sheet with async/await mode", async t => {
  const result = await spreadsheet.read();
  resultRead = result;
  t.deepEqual(
    result,
    [
      {
        rid: "1",
        test_1: "I am test1 row 1",
        test_2: "I am test2 row 1",
        test_3: "I am test3 row 1"
      },
      {
        rid: "2",
        test_1: "I am test1 row 2",
        test_2: "I am test2 row 2",
        test_3: "I am test3 row 2"
      }
    ],
    "Invalid reponse"
  );
});

/**
 * @description : I want to save my sheet with async/await mode
 */
test("I want to save my sheet with async/await mode", async t => {
  resultRead[0].test_1 = "I am test1 row 1 and my name is Bob1";
  resultRead[0].test_2 = "I am test2 row 1 and my name is Bob2";
  resultRead[0].test_3 = "I am test3 row 1 and my name is Bob3";
  resultRead[1].test_1 = "I am test1 row 2 and my name is Tot1";
  resultRead[1].test_2 = "I am test2 row 2 and my name is Tot2";
  resultRead[1].test_3 = "I am test3 row 2 and my name is Tot3";
  await spreadsheet.save(resultRead);
  const result = await spreadsheet.read();
  t.deepEqual(
    result,
    [
      {
        rid: "1",
        test_1: "I am test1 row 1 and my name is Bob1",
        test_2: "I am test2 row 1 and my name is Bob2",
        test_3: "I am test3 row 1 and my name is Bob3"
      },
      {
        rid: "2",
        test_1: "I am test1 row 2 and my name is Tot1",
        test_2: "I am test2 row 2 and my name is Tot2",
        test_3: "I am test3 row 2 and my name is Tot3"
      }
    ],
    "Invalid reponse"
  );
});

/**
 * @description : I want to save my sheet with normal mode
 */
test("I want to save my sheet with normal mode", async t => {
  resultRead[0].test_1 = "I am test1 row 1";
  resultRead[0].test_2 = "I am test2 row 1";
  resultRead[0].test_3 = "I am test3 row 1";
  resultRead[1].test_1 = "I am test1 row 2";
  resultRead[1].test_2 = "I am test2 row 2";
  resultRead[1].test_3 = "I am test3 row 2";
  await new Promise((resolve, reject) => {
    spreadsheet.save(resultRead, err => {
      if (err) return reject(err);
      return resolve();
    });
  });
  const result = await spreadsheet.read();
  t.deepEqual(
    result,
    [
      {
        rid: "1",
        test_1: "I am test1 row 1",
        test_2: "I am test2 row 1",
        test_3: "I am test3 row 1"
      },
      {
        rid: "2",
        test_1: "I am test1 row 2",
        test_2: "I am test2 row 2",
        test_3: "I am test3 row 2"
      }
    ],
    "Invalid reponse"
  );
});
