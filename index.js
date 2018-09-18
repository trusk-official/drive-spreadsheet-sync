const GoogleSpreadsheet = require('google-spreadsheet');
const Promise = require('bluebird');

let uncaughtExceptionCb = null;

// get a list of props
const getPropList = function getPropList(idcolumn, sheet, cells) {
  const props = [];
  for (let i = 0; i < sheet.colCount; i++) {
    props.push(cells[i].value);
  }
  return props;
};

// get a list of row ids
const getIdList = function getIdList(idcolumn, props, sheet, cells) {
  const ids = [];
  // get the index of the id column
  const idColNum = props.indexOf(idcolumn);
  // get id list
  for (let i = 1; i < sheet.rowCount; i++) {
    ids.push(cells[((i * sheet.colCount) + idColNum)].value);
  }
  return ids;
};

// cell grabber factory
const makeCellGrabber = function makeCellGrabber(idcolumn, sheet, cells) {
  const props = getPropList(idcolumn, sheet, cells);
  const ids = getIdList(idcolumn, props, sheet, cells);
  // find any cell by (id, col)
  return function getCell(id, prop) {
    return cells[props.indexOf(prop) + ((ids.indexOf(id) + 1) * sheet.colCount)];
  };
};

const DriveSpreadSheetSync = function constructor(data) {
  Object.assign(this, {
    id_column: 'rid',
  }, data);
  if (!this.spreadsheet) {
    throw new Error('No Drive spreadsheet id provided');
  }
  this.doc = new GoogleSpreadsheet(this.spreadsheet);
};

DriveSpreadSheetSync.prototype.getSheetAndCells = async function getSheetAndCells() {
  // auth
  await Promise.promisify(this.doc.useServiceAccountAuth)(this.service_account_credentials);

  // get info
  this.doc.info = await Promise.promisify(this.doc.getInfo)();

  // get sheet
  const sheet = this.sheet ? this.doc.info.worksheets.find((s) =>
    s.title === this.sheet
  ) : this.doc.info.worksheets.sheet[0];
  if (!sheet) {
    throw new Error('No sheet found');
  }

  // get cells
  const cells = await Promise.promisify(sheet.getCells)({
    'min-row': 1,
    'max-row': sheet.rowCount,
    'return-empty': true,
  });

  return { sheet, cells };
};

DriveSpreadSheetSync.prototype.read = function read(callback) {
  const self = this;
  return new Promise(async (resolve, reject) => {
    uncaughtExceptionCb = callback || reject;

    const { sheet, cells } = await self.getSheetAndCells();
    const props = getPropList(self.id_column, sheet, cells);
    const data = cells.reduce((data, cell) => {
      if (!cell.value || !(cell.row - 1) || !props[cell.col - 1]) {
        return data;
      }
      const newdata = data.slice();
      newdata[cell.row - 2] = newdata[cell.row - 2] || {};
      newdata[cell.row - 2][props[cell.col - 1]] = cell.value;
      return newdata;
    }, []);

    callback ? callback(null, data) : null;
    resolve(data);
  })
  .catch(e => callback ? callback(e) : e);
};

DriveSpreadSheetSync.prototype.save = function save(data, callback) {
  const self = this;
  return new Promise(async (resolve, reject) => {
    uncaughtExceptionCb = callback || reject;

    const { sheet, cells } = await self.getSheetAndCells();
    const cellGrabber = makeCellGrabber(self.id_column, sheet, cells);
    return Promise.map(data, (row) => {
      const rowId = row[self.id_column];
      const rowNumToUpdate = cellGrabber(rowId, self.id_column) &&
        (cellGrabber(rowId, self.id_column).value === rowId) &&
        cellGrabber(rowId, self.id_column).row;
      if (!rowNumToUpdate) {
        return sheet.addRow(row, seriesCallback);
      }
      return Object.keys(row).map((key) => {
        const cellToUpdate = cellGrabber(rowId, key);
        if (cellToUpdate) {
          cellToUpdate.value = row[key];
        }
        return true;
      });
    })
    .then(async () =>
      await Promise.promisify(sheet.bulkUpdateCells)(cells)
    )
    .then(data => {
      callback ? callback(null, data) : null;
      resolve(data);
    });
  })
  .catch(e => callback ? callback(e) : e);
};

process.on('uncaughtException', error =>
  uncaughtExceptionCb ? uncaughtExceptionCb(error) : null
);

module.exports = DriveSpreadSheetSync;
