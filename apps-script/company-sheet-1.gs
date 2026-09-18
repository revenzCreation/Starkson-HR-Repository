const CONFIG = {
  spreadsheetId: '1utH1iEiYiGOCZjAQ4_z3Mb3KdJcSDUHDyMVMnbNbTSA',
  employeeDataSpreadsheetId: '195-mJN-MRhswL6DQl3nIeXfYxmEAi7ufQd1ebrIXbII',
  employeeDataSheetId: 1807874829,
  referralSheet: 'Referrals',
  employeeSheet: '201 Files',
  referralFolderId: '1kL5CK1-ZEY51BZo6_BQjY8MSSfoEzcBl',
  employeeFolderId: '1wroebNAIgVf6oMVa1EMm6gZ_-f6dCotL'
};

const REFERRAL_FIELDS = [
  ['id', 'ID', ['id']], ['timestamp', 'Timestamp', ['timestamp', 'date']],
  ['referrerName', 'Referrer Name', ['referrer name', 'referrername']],
  ['referrerEmail', 'Referrer Email', ['referrer email', 'referreremail']],
  ['department', 'Department', ['department', 'referrer department']],
  ['candidateName', 'Candidate Name', ['candidate name', 'candidatename']],
  ['candidateEmail', 'Candidate Email', ['candidate email', 'candidateemail']],
  ['phone', 'Phone', ['phone', 'candidate phone']],
  ['portfolio', 'Portfolio', ['portfolio', 'candidate portfolio']],
  ['targetRole', 'Target Role', ['target role', 'position']],
  ['relationship', 'Relationship', ['relationship']],
  ['notes', 'HR Notes', ['hr notes', 'notes']],
  ['resumeLink', 'Resume Link', ['resume link', 'resumelink']],
  ['createdAt', 'Created At', ['created at', 'createdat']]
];

const EMPLOYEE_FIELDS = [
  ['id', 'ID', ['id']], ['surname', 'Surname', ['surname', 'last name']],
  ['firstName', 'First Name', ['first name', 'firstname', 'given name']],
  ['middleInitial', 'Middle Initial', ['middle initial', 'middleinitial', 'mi']],
  ['suffix', 'Suffix', ['suffix']], ['dateHired', 'Date Hired', ['date hired', 'datehired']],
  ['directLink', '201 File', ['201 file', 'direct link', 'directlink', 'file link']],
  ['driveFileId', 'Drive File ID', ['drive file id', 'drivefileid']]
];

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action || 'referrals-list';
    if (action === '201-list') { syncEmployeeFiles(); return json({ ok: true, records: readRecords(CONFIG.employeeSheet, EMPLOYEE_FIELDS, true) }); }
    if (action === 'list' || action === 'referrals-list') return json({ ok: true, records: readRecords(CONFIG.referralSheet, REFERRAL_FIELDS, false) });
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) { return json({ ok: false, error: error.message }); }
}

function onOpen() {
  applyDepartmentValidation();
}

function doPost(e) {
  try {
    const body = parseBody(e);
    if (!body.action || body.action === 'referral-save') return json({ ok: true, record: saveReferral(body) });
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) { return json({ ok: false, error: error.message }); }
}

function saveReferral(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.referralSheet, REFERRAL_FIELDS);
    const map = ensureSchema(sheet, REFERRAL_FIELDS);
    const id = nextId(sheet, map.id);
    const fileUrl = saveUpload(input.fileData, input.fileName, input.mimeType, CONFIG.referralFolderId, 'REFERRAL_' + id);
    const record = {
      id: id, timestamp: new Date(), referrerName: clean(input.referrerName), referrerEmail: clean(input.referrerEmail),
      department: clean(input.referrerDepartment), candidateName: clean(input.candidateName), candidateEmail: clean(input.candidateEmail),
      phone: clean(input.candidatePhone), portfolio: clean(input.candidatePortfolio || 'N/A'), targetRole: clean(input.targetRole),
      relationship: clean(input.relationship), notes: clean(input.notes || 'None provided'), resumeLink: fileUrl || 'No Resume Uploaded', createdAt: Date.now()
    };
    appendRecord(sheet, REFERRAL_FIELDS, record);
    if (fileUrl) setShortLink(sheet, sheet.getLastRow(), map.resumeLink, fileUrl, 'Open Resume');
    applyDepartmentValidation();
    formatSheet(sheet, REFERRAL_FIELDS.length);
    return record;
  } finally { lock.releaseLock(); }
}

function getEmployeeDepartmentOptions() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.employeeDataSpreadsheetId);
  const sheet = spreadsheet.getSheets().find(item => item.getSheetId() === CONFIG.employeeDataSheetId)
    || spreadsheet.getSheetByName('Employee Data');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader);
  const departmentIndex = headers.findIndex(header => /department|dept/.test(header));
  if (departmentIndex < 0) return [];
  return [...new Set(values.slice(1).map(row => String(row[departmentIndex] || '').trim()).filter(Boolean))];
}

function applyDepartmentValidation() {
  const sheet = getSheet(CONFIG.referralSheet, REFERRAL_FIELDS);
  const map = fieldMap(REFERRAL_FIELDS);
  const departments = getEmployeeDepartmentOptions();
  if (!departments.length) return;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(departments, true).setAllowInvalid(false).build();
  sheet.getRange(2, map.department, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}

function syncEmployeeFiles() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.employeeSheet, EMPLOYEE_FIELDS);
    const map = ensureSchema(sheet, EMPLOYEE_FIELDS);
    const known = {};
    if (sheet.getLastRow() > 1) sheet.getRange(2, map.driveFileId, sheet.getLastRow() - 1, 1).getValues().forEach(row => { if (row[0]) known[String(row[0])] = true; });
    const files = DriveApp.getFolderById(CONFIG.employeeFolderId).getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const identity = file.getId();
      const name = normalizeEmployeeFile(file);
      if (known[identity]) continue;
      const id = nextId(sheet, map.id);
      appendRecord(sheet, EMPLOYEE_FIELDS, { id: id, surname: name.surname, firstName: name.firstName, middleInitial: '', suffix: '', dateHired: '', directLink: file.getUrl(), driveFileId: identity });
      setShortLink(sheet, sheet.getLastRow(), map.directLink, file.getUrl(), 'Open 201 File');
      known[identity] = true;
    }
    formatSheet(sheet, EMPLOYEE_FIELDS.length);
  } finally { lock.releaseLock(); }
}

function readRecords(name, fields, employeeMode) {
  const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(row => row[map.id - 1]).map((row, index) => {
    const record = {}; fields.forEach(field => { record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1]; });
    if (map.directLink) record.directLink = getLink(sheet, index + 2, map.directLink) || record.directLink;
    if (map.resumeLink) record.resumeLink = getLink(sheet, index + 2, map.resumeLink) || record.resumeLink;
    if (employeeMode) { record.middleInitial = ''; record.suffix = ''; }
    return record;
  });
}

function getSheet(name, fields) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(name); if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureSchema(sheet, fields); return sheet;
}

function ensureSchema(sheet, fields) {
  const labels = fields.map(field => field[1]);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  const columnCount = Math.max(sheet.getLastColumn(), labels.length);
  const oldHeaders = sheet.getRange(1, 1, 1, columnCount).getValues()[0];
  const sourceMap = {}; oldHeaders.forEach((header, index) => { sourceMap[normalizeHeader(header)] = index; });
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  const oldRows = rowCount ? sheet.getRange(2, 1, rowCount, columnCount).getValues() : [];
  const rows = oldRows.map(row => fields.map(field => {
    const source = [field[1]].concat(field[2]).map(normalizeHeader).find(key => sourceMap[key] !== undefined);
    return source === undefined ? '' : row[sourceMap[source]];
  }));
  repairIds(rows, fields);
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), labels.length).clearContent();
  sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  if (rows.length) sheet.getRange(2, 1, rows.length, labels.length).setValues(rows);
  formatSheet(sheet, labels.length); return fieldMap(fields);
}

function repairIds(rows, fields) {
  const idIndex = fields.findIndex(field => field[0] === 'id'); if (idIndex < 0) return;
  let highest = rows.reduce((max, row) => Math.max(max, parseInt(String(row[idIndex]).replace(/\D/g, ''), 10) || 0), 0);
  const used = {}; rows.forEach(row => { const value = String(row[idIndex] || '').replace(/\D/g, ''); if (value) used[Number(value)] = true; });
  rows.forEach(row => { const number = parseInt(String(row[idIndex] || '').replace(/\D/g, ''), 10); if (!number || String(row[idIndex]).length !== 4) { do { highest += 1; } while (used[highest]); row[idIndex] = String(highest).padStart(4, '0'); used[highest] = true; } else row[idIndex] = String(number).padStart(4, '0'); });
}

function appendRecord(sheet, fields, record) { const values = fields.map(field => record[field[0]] == null ? '' : record[field[0]]); sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]); }
function fieldMap(fields) { const map = {}; fields.forEach((field, index) => map[field[0]] = index + 1); return map; }
function nextId(sheet, idColumn) { if (sheet.getLastRow() < 2) return '0001'; const values = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues(); const highest = values.reduce((max, row) => Math.max(max, parseInt(String(row[0]).replace(/\D/g, ''), 10) || 0), 0); return String(highest + 1).padStart(4, '0'); }
function saveUpload(data, name, mimeType, folderId, prefix) { if (!data) return ''; const bytes = Utilities.base64Decode(String(data).split(',').pop()); const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', prefix + '_' + (name || 'upload')); return DriveApp.getFolderById(folderId).createFile(blob).getUrl(); }
function normalizeEmployeeFile(file) { const original = file.getName(); const extension = (original.match(/\.[^.]+$/) || [''])[0].toUpperCase(); const base = original.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); const parts = base.split(','); const surname = clean(parts[0].trim().split(/\s+/).slice(0, parts.length > 1 ? 99 : 1).join(' ')); const firstName = clean((parts.length > 1 ? parts[1] : base.split(/\s+/)[1] || '').trim().split(/\s+/)[0]); const target = [surname, firstName].filter(Boolean).join(', ') + extension; if (target !== original) file.setName(target); return { surname: surname, firstName: firstName }; }
function setShortLink(sheet, row, column, url, label) { sheet.getRange(row, column).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(url).build()); }
function getLink(sheet, row, column) { const rich = sheet.getRange(row, column).getRichTextValue(); return rich && rich.getLinkUrl ? rich.getLinkUrl() : ''; }
function formatSheet(sheet, count) { sheet.getRange(1, 1, 1, count).setFontFamily('Arial').setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center'); if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, count).setFontFamily('Arial').setFontSize(9); normalizeIdColumn(sheet); sheet.setFrozenRows(1); }
function normalizeIdColumn(sheet) { if (sheet.getMaxRows() < 2) return; const range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1); const values = range.getValues().map(row => { const digits = String(row[0] == null ? '' : row[0]).replace(/\D/g, ''); return [digits ? digits.padStart(4, '0') : '']; }); range.setNumberFormat('@').setValues(values); }
function normalizeHeader(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function clean(value) { return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toUpperCase(); }
function parseBody(e) { return JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
