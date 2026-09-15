const CONFIG = {
  spreadsheetId: '195-mJN-MRhswL6DQl3nIeXfYxmEAi7ufQd1ebrIXbII',
  mrfSheet: 'MRF', mrfSheetAliases: ['MRF', 'MRF Requests', 'Manpower Requests', 'MRF Monitor'],
  applicantsSheet: 'Applicants', applicantSheetAliases: ['Applicants', 'Applicant Forms', 'Applications'],
  mrfFolderId: '1m43NthL-cWmxjuC3iaYe9Gkxf1VHJrlq', applicantFolderId: '1kL5CK1-ZEY51BZo6_BQjY8MSSfoEzcBl'
};

const MRF_FIELDS = [
  ['id', 'ID', ['id']], ['mrfNumber', 'MRF Number', ['mrf number', 'mrfnumber']], ['department', 'Department', ['department']],
  ['position', 'Position', ['position']], ['headcount', 'Headcount', ['headcount', 'count']], ['dateRequested', 'Date Requested', ['date requested', 'daterequested']],
  ['dateNeeded', 'Date Needed', ['date needed', 'dateneeded']], ['requestedBy', 'Requested By', ['requested by', 'requestedby']],
  ['status', 'Status', ['status']], ['remarks', 'Remarks', ['remarks', 'notes']], ['fileName', 'File Name', ['file name', 'filename']],
  ['fileUrl', 'File Link', ['file link', 'fileurl', 'file url']], ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

const APPLICANT_FIELDS = [
  ['id', 'ID', ['id']], ['fullName', 'Full Name', ['full name', 'fullname', 'applicant name']], ['email', 'Email', ['email', 'applicant email']],
  ['phone', 'Phone', ['phone']], ['positionApplied', 'Position Applied', ['position applied', 'positionapplied', 'position']],
  ['department', 'Department', ['department']], ['source', 'Source', ['source']], ['availabilityDate', 'Availability Date', ['availability date', 'availabilitydate']],
  ['resumeLink', 'Resume Link', ['resume link', 'resumelink']], ['status', 'Status', ['status']], ['remarks', 'Remarks', ['remarks', 'notes']],
  ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action || 'list';
    if (action === 'list' || action === 'mrf-list') return json({ ok: true, records: readRecords(CONFIG.mrfSheet, MRF_FIELDS) });
    if (action === 'applicant-list' || action === 'applicants-list') return json({ ok: true, records: readRecords(CONFIG.applicantsSheet, APPLICANT_FIELDS) });
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

function saveMrf(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.mrfSheet, MRF_FIELDS); const map = ensureSchema(sheet, MRF_FIELDS);
    const id = normalizeId(input.id) || nextId(sheet, map.id); const fileUrl = saveUpload(input.fileData, input.fileName, input.fileMimeType, CONFIG.mrfFolderId, 'MRF_' + id); const now = Date.now();
    const record = { id: id, mrfNumber: clean(input.mrfNumber), department: clean(input.department), position: clean(input.position), headcount: Number(input.headcount) || 1, dateRequested: clean(input.dateRequested), dateNeeded: clean(input.dateNeeded), requestedBy: clean(input.requestedBy), status: clean(input.status || 'Pending'), remarks: clean(input.remarks), fileName: clean(input.fileName), fileUrl: fileUrl, createdAt: Number(input.createdAt) || now, updatedAt: now };
    upsertRecord(sheet, MRF_FIELDS, map, record); if (fileUrl) setShortLink(sheet, findRow(sheet, map.id, id), map.fileUrl, fileUrl, 'Open MRF File'); formatSheet(sheet, MRF_FIELDS.length); return record;
  } finally { lock.releaseLock(); }
}

function saveApplicant(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.applicantsSheet, APPLICANT_FIELDS); const map = ensureSchema(sheet, APPLICANT_FIELDS);
    const id = normalizeId(input.id) || nextId(sheet, map.id); const data = input.resumeData || input.fileData || ''; const name = input.resumeFileName || input.fileName || ''; const mime = input.resumeMimeType || input.fileMimeType || '';
    const resumeLink = saveUpload(data, name, mime, CONFIG.applicantFolderId, 'APPLICANT_' + id); const now = Date.now();
    const record = { id: id, fullName: clean(input.fullName), email: clean(input.email), phone: clean(input.phone), positionApplied: clean(input.positionApplied || input.position), department: clean(input.department), source: clean(input.source), availabilityDate: clean(input.availabilityDate), resumeLink: resumeLink, status: clean(input.status || 'New'), remarks: clean(input.remarks || input.notes), createdAt: Number(input.createdAt) || now, updatedAt: now };
    upsertRecord(sheet, APPLICANT_FIELDS, map, record); if (resumeLink) setShortLink(sheet, findRow(sheet, map.id, id), map.resumeLink, resumeLink, 'Open Resume'); formatSheet(sheet, APPLICANT_FIELDS.length); return record;
  } finally { lock.releaseLock(); }
}

function readRecords(name, fields) {
  const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); const values = sheet.getDataRange().getValues(); if (values.length < 2) return [];
  return values.slice(1).filter(row => row[map.id - 1]).map((row, index) => { const record = {}; fields.forEach(field => { record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1]; }); if (map.fileUrl) record.fileUrl = getLink(sheet, index + 2, map.fileUrl) || record.fileUrl; if (map.resumeLink) record.resumeLink = getLink(sheet, index + 2, map.resumeLink) || record.resumeLink; return record; }).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function deleteById(name, fields, id) { const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); const row = findRow(sheet, map.id, id); if (row) sheet.deleteRow(row); }
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
