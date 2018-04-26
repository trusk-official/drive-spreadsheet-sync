const GoogleSpreadsheet = require('google-spreadsheet');
const async = require('async');

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

DriveSpreadSheetSync.prototype.getSheetAndCells = function getSheetAndCells(callback) {
  const self = this;
  async.waterfall([
    // auth
    function auth(waterfallCallback) {
      self.doc.useServiceAccountAuth(self.service_account_credentials, waterfallCallback);
    },
    // get info
    function getInfo(waterfallCallback) {
      self.doc.getInfo((error, info) => {
        if (error) {
          return waterfallCallback(error);
        }
        self.doc.info = info;
        return waterfallCallback();
      });
    },
    // get sheet
    function getSheet(waterfallCallback) {
      waterfallCallback(null, self.sheet ? self.doc.info.worksheets.find((s) =>
        s.title === self.sheet
      ) : self.doc.info.worksheets.sheet[0]);
    },
    // get cells
    function getCells(sheet, waterfallCallback) {
      if (!sheet) {
        return waterfallCallback(new Error('No sheet found'));
      }
      return sheet.getCells({
        'min-row': 1,
        'max-row': sheet.rowCount,
        'return-empty': true,
      }, (error, cells) => waterfallCallback(error, sheet, cells));
    },
  ], callback);
};

DriveSpreadSheetSync.prototype.read = function read(callback) {
  const self = this;
  return (new Promise((resolve, reject) => {
    self.getSheetAndCells((error, sheet, cells) => {
      if (error) {
        return reject(error);
      }
      const props = getPropList(self.id_column, sheet, cells);
      let data = cells.reduce((data, cell) => {
        if (!cell.value || !(cell.row - 1) || !props[cell.col - 1]) {
          return data;
        }
        const newdata = data.slice();
        newdata[cell.row - 2] = newdata[cell.row - 2] || {};
        newdata[cell.row - 2][props[cell.col - 1]] = cell.value;
        return newdata;
      }, []);
      resolve(data);
    });
  }))
  .then(data => {
    if(callback) {
      callback(null, data);
    }
    return data;
  })
  .catch(e => {
    if(callback) {
      return callback(e);
    }
    return e;
  });
};

DriveSpreadSheetSync.prototype.save = function save(data, callback) {
  const self = this;
  return (new Promise((resolve, reject) => {
    self.getSheetAndCells((error, sheet, cells) => {
      if (error) {
        return reject(error);
      }
      const cellGrabber = makeCellGrabber(self.id_column, sheet, cells);
      async.eachSeries(data, (row, eachCallback) => {
        const rowId = row[self.id_column];
        const rowNumToUpdate = cellGrabber(rowId, self.id_column) &&
          (cellGrabber(rowId, self.id_column).value === rowId) &&
          cellGrabber(rowId, self.id_column).row;
        async.series([
          // update or insert
          function upsert(seriesCallback) {
            if (rowNumToUpdate) {
              Object.keys(row).map((key) => {
                const cellToUpdate = cellGrabber(rowId, key);
                if (cellToUpdate) {
                  cellToUpdate.value = row[key];
                }
                return true;
              });
              seriesCallback();
            } else {
              sheet.addRow(row, seriesCallback);
            }
          },
        ], eachCallback);
      }, (e) => {
        if (e) {
          return reject(e);
        }
        // bulk update
        return sheet.bulkUpdateCells(cells, (error, data) => {
          if(error) {
            return reject(error);
          }
          resolve(data);
        });
      });
    });
  }))
  .then(_ => {
    if(callback) {
      callback();
    }
    return;
  })
  .catch(e => {
    if(callback) {
      return callback(e);
    }
    throw new Error(e);
  });
};

module.exports = DriveSpreadSheetSync;
