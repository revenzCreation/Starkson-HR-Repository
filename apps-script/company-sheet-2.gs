const CONFIG = {
  spreadsheetId: '195-mJN-MRhswL6DQl3nIeXfYxmEAi7ufQd1ebrIXbII',
  mrfSheet: 'MRF', mrfSheetAliases: ['MRF', 'MRF Requests', 'Manpower Requests', 'MRF Monitor'],
  applicantsSheet: 'Applicants', applicantSheetAliases: ['Applicants', 'Applicant Forms', 'Applications'],
  employeeDataSheetId: 1807874829,
  employeeDataSheetAliases: ['Employee Data', 'Employees', 'Employee Database'],
  mrfFolderId: '1m43NthL-cWmxjuC3iaYe9Gkxf1VHJrlq', applicantFolderId: '1kL5CK1-ZEY51BZo6_BQjY8MSSfoEzcBl'
};

const MRF_FIELDS = [
  ['id', 'ID', ['id']], ['mrfNumber', 'MRF Number', ['mrf number', 'mrfnumber']], ['department', 'Department', ['department']],
  ['position', 'Position', ['position']], ['headcount', 'Headcount', ['headcount', 'count']], ['originalHeadcount', 'Original Headcount', ['original headcount', 'originalheadcount']],
  ['assignedHeadcount', 'Assigned Headcount', ['assigned headcount', 'assignedheadcount']], ['dateRequested', 'Date Requested', ['date requested', 'daterequested']],
  ['dateNeeded', 'Date Needed', ['date needed', 'dateneeded']], ['requestedBy', 'Requested By', ['requested by', 'requestedby']],
  ['status', 'Status', ['status']], ['remarks', 'Remarks', ['remarks', 'notes']], ['fileName', 'File Name', ['file name', 'filename']],
  ['fileUrl', 'File Link', ['file link', 'fileurl', 'file url']], ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

const APPLICANT_FIELDS = [
  ['id', 'ID', ['id']], ['fullName', 'Full Name', ['full name', 'fullname', 'applicant name']], ['email', 'Email', ['email', 'applicant email']],
  ['phone', 'Phone', ['phone']], ['positionApplied', 'Position Applied', ['position applied', 'positionapplied', 'position']],
  ['department', 'Department', ['department']], ['mrfTransfer', 'MRF Transfer', ['mrf transfer', 'mrftransfer', 'mrf number']], ['source', 'Source', ['source']], ['availabilityDate', 'Availability Date', ['availability date', 'availabilitydate']],
  ['resumeLink', 'Resume Link', ['resume link', 'resumelink']], ['status', 'Status', ['status']], ['remarks', 'Remarks', ['remarks', 'notes']],
  ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

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
  applyDropdownValidations();
}

function onEdit(e) {
  const range = e && e.range;
  if (!range) return;
  const sheet = range.getSheet();
  if (CONFIG.applicantSheetAliases.indexOf(sheet.getName()) < 0) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(normalizeHeader);
  const transferColumn = headers.indexOf(normalizeHeader('MRF Transfer')) + 1;
  if (transferColumn && range.getColumn() <= transferColumn && range.getLastColumn() >= transferColumn) {
    syncMrfHeadcounts();
    applyDropdownValidations();
  }
}

function saveMrf(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS); const map = ensureSchema(sheet, MRF_FIELDS);
    const id = normalizeId(input.id) || nextId(sheet, map.id); const fileUrl = saveUpload(input.fileData, input.fileName, input.fileMimeType, CONFIG.mrfFolderId, 'MRF_' + id); const now = Date.now();
    const baseHeadcount = Number(input.originalHeadcount || input.headcount) || 1;
    const record = { id: id, mrfNumber: clean(input.mrfNumber), department: clean(input.department), position: clean(input.position), headcount: baseHeadcount, originalHeadcount: baseHeadcount, assignedHeadcount: 0, dateRequested: clean(input.dateRequested), dateNeeded: clean(input.dateNeeded), requestedBy: clean(input.requestedBy), status: clean(input.status || 'Pending'), remarks: clean(input.remarks), fileName: clean(input.fileName), fileUrl: fileUrl, createdAt: Number(input.createdAt) || now, updatedAt: now };
    upsertRecord(sheet, MRF_FIELDS, map, record); if (fileUrl) setShortLink(sheet, findRow(sheet, map.id, id), map.fileUrl, fileUrl, 'Open MRF File'); syncMrfHeadcounts(); applyDropdownValidations(); formatSheet(sheet, MRF_FIELDS.length); return record;
  } finally { lock.releaseLock(); }
}

function saveApplicant(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS); const map = ensureSchema(sheet, APPLICANT_FIELDS);
    const id = normalizeId(input.id) || nextId(sheet, map.id);
    const mrfTransfer = clean(input.mrfTransfer || '');
    validateMrfTransfer(sheet, map, id, mrfTransfer);
    const data = input.resumeData || input.fileData || ''; const name = input.resumeFileName || input.fileName || ''; const mime = input.resumeMimeType || input.fileMimeType || '';
    const resumeLink = saveUpload(data, name, mime, CONFIG.applicantFolderId, 'APPLICANT_' + id); const now = Date.now();
    const record = { id: id, fullName: clean(input.fullName), email: clean(input.email), phone: clean(input.phone), positionApplied: clean(input.positionApplied || input.position), department: clean(input.department), mrfTransfer: mrfTransfer, source: clean(input.source), availabilityDate: clean(input.availabilityDate), resumeLink: resumeLink, status: clean(input.status || ''), remarks: clean(input.remarks || input.notes), createdAt: Number(input.createdAt) || now, updatedAt: now };
    upsertRecord(sheet, APPLICANT_FIELDS, map, record); if (resumeLink) setShortLink(sheet, findRow(sheet, map.id, id), map.resumeLink, resumeLink, 'Open Resume'); syncMrfHeadcounts(); applyDropdownValidations(); formatSheet(sheet, APPLICANT_FIELDS.length); return record;
  } finally { lock.releaseLock(); }
}

function readRecords(name, fields) {
  const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); if (name === CONFIG.mrfSheet) syncMrfHeadcounts(); const values = sheet.getDataRange().getValues(); if (values.length < 2) return [];
  return values.slice(1).filter(row => row[map.id - 1]).map((row, index) => { const record = {}; fields.forEach(field => { record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1]; }); if (map.fileUrl) record.fileUrl = getLink(sheet, index + 2, map.fileUrl) || record.fileUrl; if (map.resumeLink) record.resumeLink = getLink(sheet, index + 2, map.resumeLink) || record.resumeLink; return record; }).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function deleteById(name, fields, id) { const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); const row = findRow(sheet, map.id, id); if (row) sheet.deleteRow(row); if (name === CONFIG.mrfSheet) { syncMrfHeadcounts(); applyDropdownValidations(); } }

function getApplicantOptions() {
  syncMrfHeadcounts();
  applyDropdownValidations();
  return { ok: true, mrfNumbers: getMrfOptions(), positionLevels: getEmployeeLevelOptions(), departments: getEmployeeDepartmentOptions() };
}

function setupDatabase() {
  ensureSchema(getSheet(CONFIG.mrfSheet, MRF_FIELDS), MRF_FIELDS);
  ensureSchema(getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS), APPLICANT_FIELDS);
  syncMrfHeadcounts();
  applyDropdownValidations();
}

function getMrfOptions() {
  const sheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS);
  const map = ensureSchema(sheet, MRF_FIELDS);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, MRF_FIELDS.length).getValues()
    .filter(row => Number(row[map.headcount - 1] || 0) > 0)
    .map(row => String(row[map.mrfNumber - 1] || '').trim()).filter(Boolean);
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

function validateMrfTransfer(applicantSheet, applicantMap, applicantId, mrfNumber) {
  if (!mrfNumber) return;
  const mrfSheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS);
  const mrfMap = ensureSchema(mrfSheet, MRF_FIELDS);
  const rows = mrfSheet.getLastRow() < 2 ? [] : mrfSheet.getRange(2, 1, mrfSheet.getLastRow() - 1, MRF_FIELDS.length).getValues();
  const target = rows.find(row => String(row[mrfMap.mrfNumber - 1] || '').trim() === mrfNumber);
  if (!target) throw new Error('The selected MRF number does not exist.');
  const original = Number(target[mrfMap.originalHeadcount - 1] || target[mrfMap.headcount - 1]) || 0;
  const assigned = applicantSheet.getLastRow() < 2 ? [] : applicantSheet.getRange(2, 1, applicantSheet.getLastRow() - 1, APPLICANT_FIELDS.length).getValues();
  const otherAssignments = assigned.filter(row => String(row[applicantMap.mrfTransfer - 1] || '').trim() === mrfNumber && String(row[applicantMap.id - 1] || '').replace(/^0+(?=\d)/, '') !== String(applicantId).replace(/^0+(?=\d)/, '')).length;
  if (otherAssignments >= original) throw new Error('This MRF has no remaining headcount.');
}

function syncMrfHeadcounts() {
  const mrfSheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS);
  const mrfMap = ensureSchema(mrfSheet, MRF_FIELDS);
  const applicantSheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS);
  const applicantMap = ensureSchema(applicantSheet, APPLICANT_FIELDS);
  const assignedCounts = {};
  if (applicantSheet.getLastRow() >= 2) {
    applicantSheet.getRange(2, applicantMap.mrfTransfer, applicantSheet.getLastRow() - 1, 1).getValues().forEach(row => {
      const mrfNumber = String(row[0] || '').trim();
      if (mrfNumber) assignedCounts[mrfNumber] = (assignedCounts[mrfNumber] || 0) + 1;
    });
  }
  if (mrfSheet.getLastRow() < 2) return;
  const rows = mrfSheet.getRange(2, 1, mrfSheet.getLastRow() - 1, MRF_FIELDS.length).getValues();
  rows.forEach((row, index) => {
    const mrfNumber = String(row[mrfMap.mrfNumber - 1] || '').trim();
    const original = Number(row[mrfMap.originalHeadcount - 1] || row[mrfMap.headcount - 1]) || 1;
    const assigned = assignedCounts[mrfNumber] || 0;
    const available = Math.max(0, original - assigned);
    row[mrfMap.originalHeadcount - 1] = original;
    row[mrfMap.assignedHeadcount - 1] = assigned;
    row[mrfMap.headcount - 1] = available;
    if (available === 0) row[mrfMap.status - 1] = 'Fulfilled';
    else if (String(row[mrfMap.status - 1] || '').toUpperCase() === 'FULFILLED') row[mrfMap.status - 1] = 'Pending';
    mrfSheet.getRange(index + 2, 1, 1, MRF_FIELDS.length).setValues([row]);
  });
}

function applyDropdownValidations() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const applicantSheet = spreadsheet.getSheetByName(CONFIG.applicantsSheet) || CONFIG.applicantSheetAliases.map(name => spreadsheet.getSheetByName(name)).find(Boolean);
  const mrfSheet = spreadsheet.getSheetByName(CONFIG.mrfSheet) || CONFIG.mrfSheetAliases.map(name => spreadsheet.getSheetByName(name)).find(Boolean);
  if (!applicantSheet || !mrfSheet) return;
  const applicantMap = fieldMap(APPLICANT_FIELDS);
  const mrfMap = fieldMap(MRF_FIELDS);
  const rows = Math.max(applicantSheet.getMaxRows() - 1, 1);
  const mrfNumbers = getMrfOptions();
  const levels = getEmployeeLevelOptions();
  const departments = getEmployeeDepartmentOptions();
  if (levels.length) {
    const statusRange = applicantSheet.getRange(2, applicantMap.status, rows, 1);
    const allowedLevels = {}; levels.forEach(level => allowedLevels[level] = true);
    const statusValues = statusRange.getValues().map(row => [row[0] && allowedLevels[String(row[0]).trim()] ? row[0] : '']);
    statusRange.setValues(statusValues);
    statusRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(levels, true).setAllowInvalid(false).build());
  }
  if (mrfNumbers.length) applicantSheet.getRange(2, applicantMap.mrfTransfer, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(mrfNumbers, true).setAllowInvalid(true).build());
  if (departments.length) {
    const departmentRule = SpreadsheetApp.newDataValidation().requireValueInList(departments, true).setAllowInvalid(false).build();
    applicantSheet.getRange(2, applicantMap.department, rows, 1).setDataValidation(departmentRule);
    mrfSheet.getRange(2, mrfMap.department, Math.max(mrfSheet.getMaxRows() - 1, 1), 1).setDataValidation(departmentRule);
  }
  const statuses = ['Pending', 'In Review', 'Approved', 'Rejected', 'Fulfilled'];
  mrfSheet.getRange(2, mrfMap.status, Math.max(mrfSheet.getMaxRows() - 1, 1), 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).setAllowInvalid(false).build());
}

function getSheet(name, fields) { const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId); const aliases = name === CONFIG.mrfSheet ? CONFIG.mrfSheetAliases : CONFIG.applicantSheetAliases; let sheet = aliases.map(alias => ss.getSheetByName(alias)).find(Boolean); if (!sheet) sheet = ss.insertSheet(name); ensureSchema(sheet, fields); return sheet; }
function ensureSchema(sheet, fields) { const labels = fields.map(field => field[1]); if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, labels.length).setValues([labels]); const count = Math.max(sheet.getLastColumn(), labels.length); const headers = sheet.getRange(1, 1, 1, count).getValues()[0]; const source = {}; headers.forEach((header, index) => source[normalizeHeader(header)] = index); const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, count).getValues() : []; const migrated = rows.map(row => fields.map(field => { const key = [field[1]].concat(field[2]).map(normalizeHeader).find(alias => source[alias] !== undefined); return key === undefined ? '' : row[source[key]]; })); repairIds(migrated, fields); sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), labels.length).clearContent(); sheet.getRange(1, 1, 1, labels.length).setValues([labels]); if (migrated.length) sheet.getRange(2, 1, migrated.length, labels.length).setValues(migrated); formatSheet(sheet, labels.length); return fieldMap(fields); }
function repairIds(rows, fields) { const index = fields.findIndex(field => field[0] === 'id'); if (index < 0) return; let highest = rows.reduce((max, row) => Math.max(max, parseInt(String(row[index]).replace(/\D/g, ''), 10) || 0), 0); const used = {}; rows.forEach(row => { const number = parseInt(String(row[index]).replace(/\D/g, ''), 10); if (number) used[number] = true; }); rows.forEach(row => { let number = parseInt(String(row[index]).replace(/\D/g, ''), 10); if (!number) { do { highest += 1; } while (used[highest]); number = highest; used[number] = true; } row[index] = String(number).padStart(4, '0'); }); }
function upsertRecord(sheet, fields, map, record) { const row = findRow(sheet, map.id, record.id); const values = [fields.map(field => record[field[0]] == null ? '' : record[field[0]])]; if (row) sheet.getRange(row, 1, 1, fields.length).setValues(values); else sheet.getRange(sheet.getLastRow() + 1, 1, 1, fields.length).setValues(values); }
function findRow(sheet, idColumn, id) { if (sheet.getLastRow() < 2) return 0; const target = String(id).replace(/^0+(?=\d)/, ''); const values = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues(); const index = values.findIndex(row => String(row[0]).replace(/^0+(?=\d)/, '') === target); return index < 0 ? 0 : index + 2; }
function fieldMap(fields) { const map = {}; fields.forEach((field, index) => map[field[0]] = index + 1); return map; }
function nextId(sheet, column) { if (sheet.getLastRow() < 2) return '0001'; const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues(); const highest = values.reduce((max, row) => Math.max(max, parseInt(String(row[0]).replace(/\D/g, ''), 10) || 0), 0); return String(highest + 1).padStart(4, '0'); }
function normalizeId(value) { const text = String(value || '').replace(/\D/g, ''); return text ? text.padStart(4, '0') : ''; }
function saveUpload(data, name, mime, folderId, prefix) { if (!data) return ''; const bytes = Utilities.base64Decode(String(data).split(',').pop()); const blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', prefix + '_' + (name || 'upload')); return DriveApp.getFolderById(folderId).createFile(blob).getUrl(); }
function setShortLink(sheet, row, column, url, label) { sheet.getRange(row, column).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(url).build()); }
function getLink(sheet, row, column) { const rich = sheet.getRange(row, column).getRichTextValue(); return rich && rich.getLinkUrl ? rich.getLinkUrl() : ''; }
function formatSheet(sheet, count) { sheet.getRange(1, 1, 1, count).setFontFamily('Arial').setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center'); if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, count).setFontFamily('Arial').setFontSize(9); normalizeIdColumn(sheet); sheet.setFrozenRows(1); }
function normalizeIdColumn(sheet) { if (sheet.getMaxRows() < 2) return; const range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1); const values = range.getValues().map(row => { const digits = String(row[0] == null ? '' : row[0]).replace(/\D/g, ''); return [digits ? digits.padStart(4, '0') : '']; }); range.setNumberFormat('@').setValues(values); }
function normalizeHeader(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function clean(value) { return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toUpperCase(); }
function parseBody(e) { return JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
