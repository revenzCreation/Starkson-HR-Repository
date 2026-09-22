const CONFIG = {
  spreadsheetId: '195-mJN-MRhswL6DQl3nIeXfYxmEAi7ufQd1ebrIXbII',
  mrfSheet: 'MRF', mrfSheetAliases: ['MRF', 'MRF Request', 'MRF Requests', 'Manpower Requests', 'MRF Monitor'],
  applicantsSheet: 'Applicants', applicantSheetAliases: ['Applicants', 'Applicant Forms', 'Applications'],
  employeeDataSheetId: 1807874829,
  employeeDataSheetAliases: ['Employee Data', 'Employees', 'Employee Database'],
  mrfFolderId: '1m43NthL-cWmxjuC3iaYe9Gkxf1VHJrlq', applicantFolderId: '1kL5CK1-ZEY51BZo6_BQjY8MSSfoEzcBl'
};

const MRF_FIELDS = [
  ['id', 'ID', ['id']], ['mrfNumber', 'MRF Number', ['mrf number', 'mrfnumber']], ['department', 'Department', ['department']],
  ['position', 'Position', ['position']], ['originalHeadcount', 'Original Headcount', ['original headcount', 'originalheadcount']],
  ['assignedHeadcount', 'Assigned Headcount', ['assigned headcount', 'assignedheadcount']], ['dateRequested', 'Date Requested', ['date requested', 'daterequested']],
  ['dateNeeded', 'Date Needed', ['date needed', 'dateneeded']], ['requestedBy', 'Requested By', ['requested by', 'requestedby']],
  ['status', 'Status', ['status']], ['remarks', 'Remarks', ['remarks', 'notes']], ['fileName', 'File Name', ['file name', 'filename']],
  ['fileUrl', 'File Link', ['file link', 'fileurl', 'file url']], ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

const APPLICANT_FIELDS = [
  ['id', 'ID', ['id']], ['fullName', 'Full Name', ['full name', 'fullname', 'applicant name']], ['email', 'Email', ['email', 'applicant email']],
  ['phone', 'Phone', ['phone']], ['gender', 'Gender', ['gender', 'sex']], ['age', 'Age', ['age']], ['positionApplied', 'Position Applied', ['position applied', 'positionapplied', 'position']],
  ['mrfTransfer', 'MRF Transfer', ['mrf transfer', 'mrftransfer', 'mrf number']],
  ['resumeLink', 'Resume Link', ['resume link', 'resumelink']],
  ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

const MRF_STATUSES = ['In Progress', 'Filled', 'Overfilled'];

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action || 'list';
    if (action === 'list' || action === 'mrf-list') return json({ ok: true, records: readRecords(CONFIG.mrfSheet, MRF_FIELDS) });
    if (action === 'applicant-list' || action === 'applicants-list') return json({ ok: true, records: readRecords(CONFIG.applicantsSheet, APPLICANT_FIELDS) });
    if (action === 'applicant-options') return json(getApplicantOptions());
    if (action === 'department-options') return json({ ok: true, departments: getEmployeeDepartmentOptions() });
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) { return json({ ok: false, error: error.message }); }
}

function doPost(e) {
  try {
    const body = parseBody(e);
    if (body.action === 'save') return json({ ok: true, record: saveMrf(body.record || {}) });
    if (body.action === 'delete') { deleteById(CONFIG.mrfSheet, MRF_FIELDS, body.id); return json({ ok: true }); }
    if (body.action === 'save-applicant' || body.action === 'applicant-save') return json({ ok: true, record: saveApplicant(body.record || body.applicant || {}) });
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) { return json({ ok: false, error: error.message }); }
}

function onOpen() {
  clearApplicantDropdowns();
}

function onEdit(e) {
  const range = e && e.range;
  if (!range) return;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const isApplicantSheet = CONFIG.applicantSheetAliases.indexOf(sheetName) >= 0 || sheetName === CONFIG.applicantsSheet;
  const isMrfSheet = CONFIG.mrfSheetAliases.indexOf(sheetName) >= 0 || sheetName === CONFIG.mrfSheet;
  if (!isApplicantSheet && !isMrfSheet) return;
  if (isMrfSheet) {
    syncMrfHeadcounts();
    clearApplicantDropdowns();
    return;
  }
  const row = range.getRow();
  if (row < 2) return;
  const applicantMap = ensureSchema(sheet, APPLICANT_FIELDS);
  const rowValues = sheet.getRange(row, 1, 1, APPLICANT_FIELDS.length).getValues()[0];
  const hasApplicantInformation = [
    applicantMap.id,
    applicantMap.fullName,
    applicantMap.email,
    applicantMap.phone,
    applicantMap.positionApplied,
    applicantMap.mrfTransfer
  ].some(column => String(rowValues[column - 1] || '').trim());
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(normalizeHeader);
  const transferColumn = headers.indexOf(normalizeHeader('MRF Transfer')) + 1;
  const touchesTransfer = transferColumn && range.getColumn() <= transferColumn && range.getLastColumn() >= transferColumn;
  if (hasApplicantInformation || touchesTransfer) {
    clearApplicantDropdowns();
    syncApplicantAssignmentState();
    if (touchesTransfer) syncMrfHeadcounts();
  }
}

function saveMrf(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS); const map = ensureSchema(sheet, MRF_FIELDS);
    const id = normalizeId(input.id) || nextId(sheet, map.id); const fileUrl = saveUpload(input.fileData, input.fileName, input.fileMimeType, CONFIG.mrfFolderId, 'MRF_' + id); const now = Date.now();
    const baseHeadcount = Number(input.originalHeadcount || input.headcount) || 1;
    const record = { id: id, mrfNumber: cleanUpper(input.mrfNumber), department: clean(input.department), position: clean(input.position), originalHeadcount: baseHeadcount, assignedHeadcount: 0, dateRequested: clean(input.dateRequested), dateNeeded: clean(input.dateNeeded), requestedBy: clean(input.requestedBy), status: normalizeMrfStatus(input.status), remarks: clean(input.remarks), fileName: clean(input.fileName), fileUrl: fileUrl, createdAt: Number(input.createdAt) || now, updatedAt: now };
    upsertRecord(sheet, MRF_FIELDS, map, record); if (fileUrl) setShortLink(sheet, findRow(sheet, map.id, id), map.fileUrl, fileUrl, 'Open MRF File'); syncMrfHeadcounts(); syncApplicantAssignmentState(); applyDropdownValidations(); formatSheet(sheet, MRF_FIELDS.length); return record;
  } finally { lock.releaseLock(); }
}

function saveApplicant(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS); const map = ensureSchema(sheet, APPLICANT_FIELDS);
    const id = normalizeId(input.id) || nextId(sheet, map.id);
    const mrfTransfer = cleanUpper(input.mrfTransfer || '');
    validateMrfTransfer(sheet, map, id, mrfTransfer);
    const data = input.resumeData || input.fileData || ''; const name = input.resumeFileName || input.fileName || ''; const mime = input.resumeMimeType || input.fileMimeType || '';
    const resumeLink = saveUpload(data, name, mime, CONFIG.applicantFolderId, 'APPLICANT_' + id); const now = Date.now();
    const mergedFullName = [input.firstName, input.middleInitial, input.lastName].filter(Boolean).join(' ').trim();
    const selectedPosition = String(input.positionApplied || input.position || '').trim();
    const record = { id: id, fullName: clean(mergedFullName || input.fullName), email: clean(input.email).toLowerCase(), phone: clean(input.phone), gender: clean(input.gender), age: clean(input.age), positionApplied: clean(selectedPosition), mrfTransfer: mrfTransfer, resumeLink: resumeLink, createdAt: Number(input.createdAt) || now, updatedAt: now };
    upsertRecord(sheet, APPLICANT_FIELDS, map, record); if (resumeLink) setShortLink(sheet, findRow(sheet, map.id, id), map.resumeLink, resumeLink, 'Open Resume'); syncApplicantAssignmentState(); syncMrfHeadcounts(); applyDropdownValidations(); formatSheet(sheet, APPLICANT_FIELDS.length); return record;
  } finally { lock.releaseLock(); }
}

function readRecords(name, fields) {
  const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); if (name === CONFIG.mrfSheet) syncMrfHeadcounts(); const values = sheet.getDataRange().getValues(); if (values.length < 2) return [];
  return values.slice(1).filter(row => row[map.id - 1]).map((row, index) => { const record = {}; fields.forEach(field => { record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1]; }); if (map.fileUrl) record.fileUrl = getLink(sheet, index + 2, map.fileUrl) || record.fileUrl; if (map.resumeLink) record.resumeLink = getLink(sheet, index + 2, map.resumeLink) || record.resumeLink; return record; }).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function deleteById(name, fields, id) { const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); const row = findRow(sheet, map.id, id); if (row) sheet.deleteRow(row); if (name === CONFIG.mrfSheet) { syncMrfHeadcounts(); applyDropdownValidations(); } }

function getApplicantOptions() {
  syncMrfHeadcounts();
  clearApplicantDropdowns();
  return { ok: true, mrfNumbers: getMrfOptions(), positionLevels: getEmployeeLevelOptions() };
}

function setupDatabase() {
  ensureSchema(getSheet(CONFIG.mrfSheet, MRF_FIELDS), MRF_FIELDS);
  ensureSchema(getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS), APPLICANT_FIELDS);
  syncApplicantAssignmentState();
  syncMrfHeadcounts();
  clearApplicantDropdowns();
}

function getMrfOptions(includeAvailableOnly = false) {
  const sheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS);
  const map = ensureSchema(sheet, MRF_FIELDS);
  if (sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, MRF_FIELDS.length).getValues();
  const options = rows
    .map(row => String(row[map.mrfNumber - 1] || '').trim())
    .filter(Boolean)
    .filter(mrfNumber => {
      if (!includeAvailableOnly) return true;
      const mrfRow = rows.find(row => String(row[map.mrfNumber - 1] || '').trim() === mrfNumber);
      if (!mrfRow) return false;
      const original = Number(mrfRow[map.originalHeadcount - 1] || 0);
      const assigned = Number(mrfRow[map.assignedHeadcount - 1] || 0);
      const status = normalizeMrfStatus(mrfRow[map.status - 1]);
      return original > 0 && assigned < original && String(status).toUpperCase() !== 'FULFILLED';
    });
  return [...new Set(options)];
}

function getAvailableMrfOptions() {
  return getMrfOptions(true);
}

function getEmployeeDataSheet() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  return spreadsheet.getSheets().find(sheet => sheet.getSheetId() === CONFIG.employeeDataSheetId)
    || CONFIG.employeeDataSheetAliases.map(name => spreadsheet.getSheetByName(name)).find(Boolean);
}

function getEmployeeLevelOptions() {
  const sheet = getEmployeeDataSheet();
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader);
  const levelIndex = headers.findIndex(header => /positionlevel|employeelevel|joblevel|level|rank/.test(header));
  if (levelIndex < 0) return [];
  return [...new Set(values.slice(1).map(row => String(row[levelIndex] || '').trim()).filter(Boolean))];
}

function getEmployeeDepartmentOptions() {
  const sheet = getEmployeeDataSheet();
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader);
  const departmentIndex = headers.findIndex(header => /department|dept/.test(header));
  if (departmentIndex < 0) return [];
  return [...new Set(values.slice(1).map(row => String(row[departmentIndex] || '').trim()).filter(Boolean))];
}

function getEmployeeColumnOptions(aliases) {
  const sheet = getEmployeeDataSheet();
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader);
  const index = headers.findIndex(header => aliases.some(alias => header === normalizeHeader(alias) || header.indexOf(normalizeHeader(alias)) >= 0));
  if (index < 0) return [];
  return [...new Set(values.slice(1).map(row => String(row[index] || '').trim()).filter(Boolean))];
}

function getAssignedHeadcountByMrf(excludeApplicantId) {
  const applicantSheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS);
  const applicantMap = ensureSchema(applicantSheet, APPLICANT_FIELDS);
  const counts = {};
  if (applicantSheet.getLastRow() < 2) return counts;
  const rows = applicantSheet.getRange(2, 1, applicantSheet.getLastRow() - 1, APPLICANT_FIELDS.length).getValues();
  rows.forEach(row => {
    const applicantId = String(row[applicantMap.id - 1] || '').replace(/^0+(?=\d)/, '');
    if (excludeApplicantId && applicantId === String(excludeApplicantId).replace(/^0+(?=\d)/, '')) return;
    const mrfNumber = String(row[applicantMap.mrfTransfer - 1] || '').trim();
    if (!mrfNumber) return;
    const key = mrfNumber.toUpperCase();
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function validateMrfTransfer(applicantSheet, applicantMap, applicantId, mrfNumber) {
  if (!mrfNumber) return;
  const mrfSheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS);
  const mrfMap = ensureSchema(mrfSheet, MRF_FIELDS);
  const rows = mrfSheet.getLastRow() < 2 ? [] : mrfSheet.getRange(2, 1, mrfSheet.getLastRow() - 1, MRF_FIELDS.length).getValues();
  const target = rows.find(row => String(row[mrfMap.mrfNumber - 1] || '').trim().toUpperCase() === mrfNumber.toUpperCase());
  if (!target) throw new Error('The selected MRF number does not exist.');
}

function columnToLetter(column) {
  let value = '';
  let current = column;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function syncMrfHeadcounts() {
  const mrfSheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS);
  const mrfMap = ensureSchema(mrfSheet, MRF_FIELDS);
  const applicantSheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS);
  const applicantMap = ensureSchema(applicantSheet, APPLICANT_FIELDS);
  const transferColumn = applicantMap.mrfTransfer || 8;
  const mrfNumberColumn = mrfMap.mrfNumber || 2;
  const assignedColumn = mrfMap.assignedHeadcount || 6;

  if (mrfSheet.getLastRow() < 2) return;
  const rows = mrfSheet.getRange(2, 1, mrfSheet.getLastRow() - 1, MRF_FIELDS.length).getValues();
  rows.forEach((row, index) => {
    const sheetRow = index + 2;
    const mrfNumber = String(row[mrfMap.mrfNumber - 1] || '').trim();
    const original = Number(row[mrfMap.originalHeadcount - 1] || 0) || 1;
    const assignedRange = mrfSheet.getRange(sheetRow, assignedColumn);
    const formula = '=COUNTIF(Applicants!$' + columnToLetter(transferColumn) + ':$' + columnToLetter(transferColumn) + ', $' + columnToLetter(mrfNumberColumn) + sheetRow + ')';
    assignedRange.setFormula(formula);

    if (!mrfNumber) {
      mrfSheet.getRange(sheetRow, assignedColumn).setValue(0);
      return;
    }
    const assigned = Number(assignedRange.getValue()) || 0;
    const status = assigned > original ? 'Overfilled' : assigned === original ? 'Filled' : 'In Progress';
    const statusRange = mrfSheet.getRange(sheetRow, mrfMap.status);
    statusRange.setValue(status).setBackground(status === 'Overfilled' ? '#F4CCCC' : null);
  });
}

function clearApplicantDropdowns() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const applicantSheet = spreadsheet.getSheetByName(CONFIG.applicantsSheet) || CONFIG.applicantSheetAliases.map(name => spreadsheet.getSheetByName(name)).find(Boolean);
  if (!applicantSheet) return;
  const applicantMap = ensureSchema(applicantSheet, APPLICANT_FIELDS);
  const lastRow = Math.max(applicantSheet.getLastRow(), 2);
  applicantSheet.getRange(2, applicantMap.mrfTransfer, Math.max(lastRow - 1, 1), 1).clearDataValidations();
}

function clearAllDataValidations(sheet) {
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
}

function syncApplicantAssignmentState() {
  const applicantSheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS);
  const applicantMap = ensureSchema(applicantSheet, APPLICANT_FIELDS);
  if (applicantSheet.getLastRow() < 2) return;
  const rows = applicantSheet.getRange(2, 1, applicantSheet.getLastRow() - 1, APPLICANT_FIELDS.length).getValues();
  rows.forEach((row, index) => {
    const sheetRow = index + 2;
    const mrfTransfer = String(row[applicantMap.mrfTransfer - 1] || '').trim();
    const isAssigned = Boolean(mrfTransfer);
    applicantSheet.getRange(sheetRow, 1, 1, APPLICANT_FIELDS.length).setBackground(isAssigned ? '#F4B183' : null);
  });
}

function normalizeApplicantStatus(value) {
  const status = clean(value || 'Applied');
  const canonical = APPLICANT_STATUSES.find(option => option.toLowerCase() === status.toLowerCase());
  if (canonical) return canonical;
  if (LEGACY_APPLICANT_STATUSES.some(option => option.toLowerCase() === status.toLowerCase())) return status;
  return 'Applied';
}

function syncActiveApplicantsToEmployeeData() {
  const applicantSheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS);
  const applicantMap = ensureSchema(applicantSheet, APPLICANT_FIELDS);
  const employeeSheet = getEmployeeDataSheet();
  if (!employeeSheet || applicantSheet.getLastRow() < 2) return;
  const employeeValues = employeeSheet.getDataRange().getValues();
  if (!employeeValues.length) return;
  const employeeHeaders = employeeValues[0].map(normalizeHeader);
  const employeeRows = employeeValues.slice(1);
  const applicantRows = applicantSheet.getRange(2, 1, applicantSheet.getLastRow() - 1, APPLICANT_FIELDS.length).getValues();
  const applicantRecords = applicantRows.map(row => { const record = {}; APPLICANT_FIELDS.forEach(field => { record[field[0]] = row[applicantMap[field[0]] - 1]; }); return record; });
  const idIndex = employeeHeaders.findIndex(header => header === 'id' || header === 'employeeid' || header === 'applicantid');
  const emailIndex = employeeHeaders.findIndex(header => header === 'email' || header === 'emailaddress');
  applicantRecords.filter(record => normalizeApplicantStatus(record.status) === 'Active').forEach(record => {
    const existingIndex = employeeRows.findIndex(row => (idIndex >= 0 && String(row[idIndex] || '') === String(record.id || '')) || (emailIndex >= 0 && String(row[emailIndex] || '').toLowerCase() === String(record.email || '').toLowerCase()));
    const targetRow = existingIndex >= 0 ? employeeRows[existingIndex].slice() : new Array(employeeHeaders.length).fill('');
    const nameParts = String(record.fullName || '').trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts.shift() || '';
    const surname = nameParts.pop() || '';
    const middleInitial = nameParts.length ? nameParts.join(' ').charAt(0) : '';
    employeeHeaders.forEach((header, index) => {
      const field = APPLICANT_FIELDS.find(item => item[1] && (normalizeHeader(item[1]) === header || item[2].some(alias => normalizeHeader(alias) === header)));
      if (field) {
        targetRow[index] = record[field[0]] == null ? '' : record[field[0]];
      } else if (/^(surname|lastname|familyname)$/.test(header)) {
        targetRow[index] = surname;
      } else if (/^(firstname|givenname)$/.test(header)) {
        targetRow[index] = firstName;
      } else if (/^(middleinitial|middlename|mi)$/.test(header)) {
        targetRow[index] = middleInitial;
      } else if (/^(fullname|applicantname|employeename|name)$/.test(header)) {
        targetRow[index] = record.fullName || '';
      }
    });
    if (existingIndex >= 0) employeeSheet.getRange(existingIndex + 2, 1, 1, employeeHeaders.length).setValues([targetRow]);
    else employeeSheet.getRange(employeeSheet.getLastRow() + 1, 1, 1, employeeHeaders.length).setValues([targetRow]);
  });
}

function normalizeMrfStatus(value) {
  const status = clean(value || 'In Progress').toLowerCase();
  const normalized = MRF_STATUSES.find(option => option.toLowerCase() === status);
  if (normalized) return normalized;
  if (status === 'fulfilled') return 'Filled';
  return 'In Progress';
}

function getSheet(name, fields) { const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId); const aliases = name === CONFIG.mrfSheet ? CONFIG.mrfSheetAliases : CONFIG.applicantSheetAliases; let sheet = aliases.map(alias => ss.getSheetByName(alias)).find(Boolean); if (!sheet) sheet = ss.insertSheet(name); ensureSchema(sheet, fields); return sheet; }
function ensureSchema(sheet, fields) { const labels = fields.map(field => field[1]); if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, labels.length).setValues([labels]); const count = Math.max(sheet.getLastColumn(), labels.length); const headers = sheet.getRange(1, 1, 1, count).getValues()[0]; const source = {}; headers.forEach((header, index) => source[normalizeHeader(header)] = index); const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, count).getValues() : []; const richRows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, count).getRichTextValues() : []; const migrated = rows.map((row, rowIndex) => fields.map(field => { const key = [field[1]].concat(field[2]).map(normalizeHeader).find(alias => source[alias] !== undefined); if (key === undefined) return ''; const sourceIndex = source[key]; if (field[0] === 'fileUrl' || field[0] === 'resumeLink') { const rich = richRows[rowIndex] && richRows[rowIndex][sourceIndex]; const link = rich && rich.getLinkUrl ? rich.getLinkUrl() : ''; if (link) return link; } return row[sourceIndex]; })); repairIds(migrated, fields); if (sheet.getLastColumn() > labels.length) sheet.deleteColumns(labels.length + 1, sheet.getLastColumn() - labels.length); sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), labels.length).clearContent(); sheet.getRange(1, 1, 1, labels.length).setValues([labels]); if (migrated.length) sheet.getRange(2, 1, migrated.length, labels.length).setValues(migrated); formatSheet(sheet, labels.length); const map = fieldMap(fields); restoreFileLinks(sheet, map); return map; }
function repairIds(rows, fields) { const index = fields.findIndex(field => field[0] === 'id'); if (index < 0) return; let highest = rows.reduce((max, row) => Math.max(max, parseInt(String(row[index]).replace(/\D/g, ''), 10) || 0), 0); const used = {}; rows.forEach(row => { const number = parseInt(String(row[index]).replace(/\D/g, ''), 10); if (number) used[number] = true; }); rows.forEach(row => { let number = parseInt(String(row[index]).replace(/\D/g, ''), 10); if (!number || String(row[index]).length !== 5) { do { highest += 1; } while (used[highest]); number = highest; used[number] = true; } row[index] = String(number).padStart(5, '0'); }); }
function upsertRecord(sheet, fields, map, record) { const row = findRow(sheet, map.id, record.id); const values = [fields.map(field => record[field[0]] == null ? '' : record[field[0]])]; if (row) sheet.getRange(row, 1, 1, fields.length).setValues(values); else sheet.getRange(sheet.getLastRow() + 1, 1, 1, fields.length).setValues(values); }
function findRow(sheet, idColumn, id) { if (sheet.getLastRow() < 2) return 0; const target = String(id).replace(/^0+(?=\d)/, ''); const values = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues(); const index = values.findIndex(row => String(row[0]).replace(/^0+(?=\d)/, '') === target); return index < 0 ? 0 : index + 2; }
function fieldMap(fields) { const map = {}; fields.forEach((field, index) => map[field[0]] = index + 1); return map; }
function nextId(sheet, column) { if (sheet.getLastRow() < 2) return '00001'; const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues(); const highest = values.reduce((max, row) => Math.max(max, parseInt(String(row[0]).replace(/\D/g, ''), 10) || 0), 0); return String(highest + 1).padStart(5, '0'); }
function normalizeId(value) { const text = String(value || '').replace(/\D/g, ''); return text ? text.padStart(5, '0') : ''; }
function saveUpload(data, name, mime, folderId, prefix) { if (!data) return ''; const bytes = Utilities.base64Decode(String(data).split(',').pop()); const blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', prefix + '_' + (name || 'upload')); return DriveApp.getFolderById(folderId).createFile(blob).getUrl(); }
function setShortLink(sheet, row, column, url, label) { if (!url || !column || !row) return; sheet.getRange(row, column).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(String(url)).build()); }
function restoreFileLinks(sheet, map) { [['fileUrl', 'Open MRF File'], ['resumeLink', 'Open Resume']].forEach(item => { const column = map[item[0]]; if (!column || sheet.getLastRow() < 2) return; const range = sheet.getRange(2, column, sheet.getLastRow() - 1, 1); const values = range.getDisplayValues(); values.forEach((row, index) => { const url = String(row[0] || '').trim(); if (url && /^https?:\/\//i.test(url)) setShortLink(sheet, index + 2, column, url, item[1]); }); }); }
function getLink(sheet, row, column) { const rich = sheet.getRange(row, column).getRichTextValue(); return rich && rich.getLinkUrl ? rich.getLinkUrl() : ''; }
function formatSheet(sheet, count) { sheet.getRange(1, 1, 1, count).setFontFamily('Arial').setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center'); if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, count).setFontFamily('Arial').setFontSize(9); normalizeIdColumn(sheet); sheet.setFrozenRows(1); }
function normalizeIdColumn(sheet) { if (sheet.getMaxRows() < 2) return; const range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1); const values = range.getValues().map(row => { const digits = String(row[0] == null ? '' : row[0]).replace(/\D/g, ''); return [digits ? digits.padStart(5, '0') : '']; }); range.setNumberFormat('@').setValues(values); }
function normalizeHeader(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function clean(value) { return String(value == null ? '' : value).trim().replace(/\s+/g, ' '); }
function cleanUpper(value) { return clean(value).toUpperCase(); }
function parseBody(e) { return JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
