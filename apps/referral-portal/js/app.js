const REFERRALS_KEY = 'starksonReferrals';
const APPLICANTS_KEY = 'starksonApplicants';

function getSheet1Url() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet1;
  if (!apiUrl) throw new Error('The referral connection is not configured.');
  return apiUrl;
}

function getSheet2Url() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet2;
  if (!apiUrl) throw new Error('The department connection is not configured.');
  return apiUrl;
}

function readLocalList(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (error) { return []; }
}

function writeLocalList(key, records) {
  localStorage.setItem(key, JSON.stringify(records));
}

const form = document.getElementById('referralForm');
const applicantForm = document.getElementById('applicantForm');

const landingView = document.getElementById('landingView');
const formView = document.getElementById('formView');
const applicantView = document.getElementById('applicantView');
const startReferralBtn = document.getElementById('startReferralBtn');
const startApplicantBtn = document.getElementById('startApplicantBtn');
const backBtn = document.getElementById('backBtn');
const applicantBackBtn = document.getElementById('applicantBackBtn');
const deptSelect = document.getElementById('referrerDepartment');
const applicantDepartmentSelect = document.getElementById('applicantDepartment');
const otherDeptGroup = document.getElementById('otherDeptGroup');
const otherDeptInput = document.getElementById('otherDepartment');
const relationshipSelect = document.getElementById('relationship');
const otherRelationshipGroup = document.getElementById('otherRelationshipGroup');
const otherRelationshipInput = document.getElementById('otherRelationship');
const phoneInput = document.getElementById('candidatePhone');
const notesArea = document.getElementById('notes');
const charCount = document.getElementById('charCount');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('resume');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFileBtn');
const dropZoneContent = document.getElementById('dropZoneContent');
const resumeGroup = document.getElementById('resumeGroup');
const fileError = document.getElementById('fileError');
const statusDiv = document.getElementById('statusMessage');
function safeReadDraft() {
  try {
    const raw = localStorage.getItem('referralDraft');
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

const saveDraft = () => {
  if (!form) return;
  const draft = {};
  const inputs = form.querySelectorAll('input:not([type="file"]), select, textarea');
  inputs.forEach(input => {
    draft[input.id] = input.value;
  });
  localStorage.setItem('referralDraft', JSON.stringify(draft));
};

const debounce = (func, delay = 500) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
};

if (startReferralBtn) {
  startReferralBtn.addEventListener('click', () => {
    if (landingView) landingView.classList.replace('active', 'hidden');
    setTimeout(() => {
      if (formView) formView.classList.replace('hidden', 'active');
      const referrerName = document.getElementById('referrerName');
      if (referrerName) referrerName.focus();
    }, 150);
  });
}

if (backBtn) {
  backBtn.addEventListener('click', () => {
    if (formView) formView.classList.replace('active', 'hidden');
    setTimeout(() => {
      if (landingView) landingView.classList.replace('hidden', 'active');
    }, 150);
  });
}

if (startApplicantBtn) {
  startApplicantBtn.addEventListener('click', () => {
    if (landingView) landingView.classList.replace('active', 'hidden');
    setTimeout(() => {
      if (applicantView) applicantView.classList.replace('hidden', 'active');
      const applicantName = document.getElementById('applicantName');
      if (applicantName) applicantName.focus();
    }, 150);
  });
}

if (applicantBackBtn) {
  applicantBackBtn.addEventListener('click', () => {
    if (applicantView) applicantView.classList.replace('active', 'hidden');
    setTimeout(() => {
      if (landingView) landingView.classList.replace('hidden', 'active');
    }, 150);
  });
}

if (form) {
  form.addEventListener('input', debounce(saveDraft, 800));
  form.addEventListener('change', saveDraft);
}

document.addEventListener('DOMContentLoaded', () => {
  const draft = safeReadDraft();
  Object.keys(draft).forEach(key => {
    const field = document.getElementById(key);
    if (field) field.value = draft[key];
  });
  checkOtherDeptVisibility();
  checkOtherRelationshipVisibility();
  updateProgress();
  loadDepartmentOptions();
});

async function loadDepartmentOptions() {
  const selects = [deptSelect, applicantDepartmentSelect].filter(Boolean);
  if (!selects.length) return;
  const departments = Array.isArray(window.STARKSON_DEPARTMENTS) ? window.STARKSON_DEPARTMENTS : [];
  selects.forEach(select => {
    const selectedValue = select.value;
    select.disabled = false;
    select.innerHTML = '<option value="" disabled selected>Select department</option>';
    departments.forEach(department => {
      const option = document.createElement('option');
      option.value = department;
      option.textContent = department;
      select.appendChild(option);
    });
    if (departments.includes(selectedValue)) select.value = selectedValue;
  });
}

function checkOtherDeptVisibility() {
  if (!deptSelect || !otherDeptGroup || !otherDeptInput) return;
  if (deptSelect.value === 'Other') {
    otherDeptGroup.classList.add('show');
    otherDeptInput.setAttribute('required', 'true');
  } else {
    otherDeptGroup.classList.remove('show');
    otherDeptInput.removeAttribute('required');
    otherDeptInput.value = '';
    otherDeptGroup.classList.remove('invalid');
  }
}
if (deptSelect) deptSelect.addEventListener('change', checkOtherDeptVisibility);

function checkOtherRelationshipVisibility() {
  if (!relationshipSelect || !otherRelationshipGroup || !otherRelationshipInput) return;
  if (relationshipSelect.value === 'Other') {
    otherRelationshipGroup.classList.add('show');
    otherRelationshipInput.setAttribute('required', 'true');
  } else {
    otherRelationshipGroup.classList.remove('show');
    otherRelationshipInput.removeAttribute('required');
    otherRelationshipInput.value = '';
    otherRelationshipGroup.classList.remove('invalid');
  }
}
if (relationshipSelect) relationshipSelect.addEventListener('change', checkOtherRelationshipVisibility);

if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    let formatted = val;
    if (val.length > 4) formatted = val.substring(0, 4) + ' ' + val.substring(4);
    if (val.length > 7) formatted = formatted.substring(0, 8) + ' ' + formatted.substring(8);
    e.target.value = formatted;
  });
}

const steps = ['step1', 'step2', 'step3'];
let currentStepIndex = 0;

document.querySelectorAll('.next-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetStepId = e.target.getAttribute('data-next');
    if (targetStepId && validateStep(steps[currentStepIndex])) {
      transitionStep(steps[currentStepIndex], targetStepId);
      currentStepIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    }
  });
});

document.querySelectorAll('.prev-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetStepId = e.target.getAttribute('data-prev');
    if (targetStepId) {
      transitionStep(steps[currentStepIndex], targetStepId);
      currentStepIndex = Math.max(currentStepIndex - 1, 0);
    }
  });
});

function transitionStep(currentId, nextId) {
  const currentStep = document.getElementById(currentId);
  const nextStep = document.getElementById(nextId);
  if (!currentStep || !nextStep) return;
  currentStep.classList.replace('active', 'hidden');
  nextStep.classList.replace('hidden', 'active');
  const firstInput = nextStep.querySelector('input, select, textarea');
  if (firstInput) firstInput.focus();

  const stepNum = nextId === 'step1' ? 1 : nextId === 'step2' ? 2 : 3;
  [1, 2, 3].forEach(n => {
    const el = document.getElementById(`wizardStep${n}`);
    if (!el) return;
    el.classList.remove('active', 'completed');
    if (n < stepNum) el.classList.add('completed');
    if (n === stepNum) el.classList.add('active');
  });
}

function validateField(input) {
  if (!input || typeof input.closest !== 'function') return true;
  const group = input.closest('.form-group');
  if (!group) return true;

  let isValid = true;
  let customError = '';

  if (input.hasAttribute('required') && !input.value.trim()) {
    isValid = false;
  } else if (input.value.trim()) {
    if (input.id === 'referrerEmail') {
      const gmailRegex = /^[a-z0-9._%+-]+@gmail\.com$/i;
      if (!gmailRegex.test(input.value.trim())) {
        isValid = false;
        customError = 'Must be a valid @gmail.com address.';
      }
    }

    if (input.id === 'candidateEmail') {
      const gmailRegex = /^[a-z0-9._%+-]+@gmail\.com$/i;
      if (!gmailRegex.test(input.value.trim())) {
        isValid = false;
        customError = 'Candidate email must end with @gmail.com.';
      }
    }

    if (input.id === 'candidatePhone') {
      const rawPhone = input.value.replace(/\s/g, '');
      const phoneRegex = /^09\d{9}$/;
      if (!phoneRegex.test(rawPhone)) {
        isValid = false;
        customError = 'Must be exactly 11 digits starting with 09.';
      }
    }
  }

  if (!isValid) {
    group.classList.add('invalid');
    const errorElement = group.querySelector('.error-msg');
    if (customError && errorElement) errorElement.textContent = customError;
  } else {
    group.classList.remove('invalid');
  }

  return isValid;
}

if (form) {
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('blur', () => validateField(input));
  });
}

function validateStep(stepId) {
  const step = document.getElementById(stepId);
  if (!step) return false;
  const inputs = step.querySelectorAll('input, select, textarea');
  let isStepValid = true;

  inputs.forEach(input => {
    const group = input.closest('.form-group');
    if (group && group.classList.contains('hidden-dept') && !group.classList.contains('show')) return;
    if (!validateField(input)) isStepValid = false;
  });

  return isStepValid;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
];

if (dropZone) {
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });
}

function clearFile(event) {
  if (event) event.stopPropagation();
  if (fileInput) fileInput.value = '';
  if (filePreview) filePreview.classList.add('hidden');
  if (dropZoneContent) dropZoneContent.classList.remove('hidden');
  if (resumeGroup) resumeGroup.classList.add('invalid');
  if (fileError) fileError.textContent = 'Please upload a valid resume file under 5MB.';
  updateProgress();
}

if (fileInput) fileInput.addEventListener('change', handleFileSelect);
if (removeFileBtn) removeFileBtn.addEventListener('click', clearFile);

function handleFileSelect() {
  if (!fileInput) return;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];

    if (file.size > MAX_FILE_SIZE) {
      clearFile();
      if (fileError) fileError.textContent = 'File exceeds 5MB limit. Please compress and try again.';
      if (resumeGroup) resumeGroup.classList.add('invalid');
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|jpg|jpeg|png|webp)$/i)) {
      clearFile();
      if (fileError) fileError.textContent = 'Invalid file type. PDF, DOC, DOCX, JPG, PNG, or WebP allowed.';
      if (resumeGroup) resumeGroup.classList.add('invalid');
      return;
    }

    if (fileName) fileName.textContent = file.name;
    if (dropZoneContent) dropZoneContent.classList.add('hidden');
    if (filePreview) filePreview.classList.remove('hidden');
    if (resumeGroup) resumeGroup.classList.remove('invalid');
  } else if (resumeGroup) {
    resumeGroup.classList.add('invalid');
  }
  updateProgress();
}

if (notesArea && charCount) {
  notesArea.addEventListener('input', () => {
    charCount.textContent = String(notesArea.value.length);
  });
}

function updateProgress() {
  const formEl = document.getElementById('referralForm');
  if (!formEl) return;

  const allRequired = Array.from(formEl.querySelectorAll('[required]'));
  const activeRequired = allRequired.filter(input => {
    const group = input.closest('.form-group');
    if (group && group.classList.contains('hidden-dept') && !group.classList.contains('show')) {
      return false;
    }
    return input.hasAttribute('required');
  });

  let filled = 0;
  activeRequired.forEach(input => {
    if (input.type === 'file' && input.files && input.files.length > 0) filled++;
    else if (input.type !== 'file' && input.value.trim() !== '') filled++;
  });

  const percent = activeRequired.length > 0 ? (filled / activeRequired.length) * 100 : 0;
  const progressBar = document.getElementById('progressBar');
  if (progressBar) progressBar.style.width = `${percent}%`;
}

if (form) {
  form.addEventListener('input', updateProgress);
  form.addEventListener('change', updateProgress);
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('loadingSpinner');

    if (!validateStep('step3')) {
      if (statusDiv) {
        statusDiv.textContent = 'Please fix the highlighted errors before submitting.';
        statusDiv.className = 'status-box error';
      }
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (statusDiv) statusDiv.className = 'status-box hidden';
    window.HR_PORTAL_SYNC?.beginOptimisticUpdate?.('referral-form', 'pending-referral', {
      referrerEmail: document.getElementById('referrerEmail')?.value.trim() || '',
      candidateEmail: document.getElementById('candidateEmail')?.value.trim() || ''
    }, 'Submitting referral...');

    const finalDept = deptSelect && deptSelect.value === 'Other' ? (otherDeptInput ? otherDeptInput.value.trim() : '') : (deptSelect ? deptSelect.value : '');
    const finalRelationship = relationshipSelect && relationshipSelect.value === 'Other' ? (otherRelationshipInput ? otherRelationshipInput.value.trim() : '') : (relationshipSelect ? relationshipSelect.value : '');
    const rawPhone = phoneInput ? phoneInput.value.replace(/\s/g, '') : '';
    const file = fileInput ? fileInput.files[0] : null;

    const submitData = async (fileData = null, fileNameStr = '', mimeTypeStr = '') => {
      const payload = {
        referrerName: document.getElementById('referrerName') ? document.getElementById('referrerName').value.trim() : '',
        referrerEmail: document.getElementById('referrerEmail') ? document.getElementById('referrerEmail').value.trim() : '',
        referrerDepartment: finalDept,
        candidateName: document.getElementById('candidateName') ? document.getElementById('candidateName').value.trim() : '',
        candidateEmail: document.getElementById('candidateEmail') ? document.getElementById('candidateEmail').value.trim() : '',
        candidatePhone: rawPhone,
        candidatePortfolio: document.getElementById('candidatePortfolio') ? document.getElementById('candidatePortfolio').value.trim() || 'N/A' : 'N/A',
        targetRole: document.getElementById('targetRole') ? document.getElementById('targetRole').value.trim() : '',
        relationship: finalRelationship,
        notes: document.getElementById('notes') ? document.getElementById('notes').value.trim() || 'None provided' : 'None provided',
        hasFile: !!fileData,
        fileName: fileNameStr,
        mimeType: mimeTypeStr,
        fileData: fileData
      };

      try {
        await window.HR_PORTAL_SHEETS.request(getSheet1Url(), {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        window.HR_PORTAL_SYNC?.resolveOptimisticUpdate?.('referral-form', 'Referral submitted successfully.');
        localStorage.removeItem('referralDraft');

        if (statusDiv) {
          statusDiv.textContent = 'Referral successfully submitted. A copy has been dispatched to your email.';
          statusDiv.className = 'status-box success';
        }

        form.reset();
        clearFile();
        checkOtherDeptVisibility();
        checkOtherRelationshipVisibility();
        if (charCount) charCount.textContent = '0';
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = '0%';

        currentStepIndex = 0;

        setTimeout(() => {
          transitionStep('step3', 'step1');
          if (submitBtn) submitBtn.disabled = false;
        }, 2000);
      } catch (error) {
        window.HR_PORTAL_SYNC?.rejectOptimisticUpdate?.('referral-form', error.message || 'Unable to complete submission at this time.');
        if (statusDiv) {
          statusDiv.textContent = error.message || 'Unable to complete submission at this time.';
          statusDiv.className = 'status-box error';
        }
        if (submitBtn) submitBtn.disabled = false;
      } finally {
        if (spinner) spinner.classList.add('hidden');
      }
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = typeof reader.result === 'string' ? reader.result.split(',')[1] : '';
        submitData(base64Data, file.name, file.type);
      };
      reader.readAsDataURL(file);
    } else {
      submitData();
    }
  });
}

if (applicantForm) {
  applicantForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const applicantStatus = document.getElementById('applicantStatusMessage');
    const values = {
      fullName: document.getElementById('applicantName')?.value.trim() || '',
      email: document.getElementById('applicantEmail')?.value.trim() || '',
      phone: document.getElementById('applicantPhone')?.value.trim() || '',
      position: document.getElementById('applicantPosition')?.value.trim() || '',
      department: document.getElementById('applicantDepartment')?.value.trim() || '',
      source: document.getElementById('applicantSource')?.value.trim() || '',
      linkedin: document.getElementById('applicantLinkedIn')?.value.trim() || '',
      notes: document.getElementById('applicantNotes')?.value.trim() || '',
      status: 'New Applicant'
    };

    if (!values.fullName || !values.email || !values.phone || !values.position || !values.department) {
      if (applicantStatus) {
        applicantStatus.textContent = 'Please complete all required fields before submitting.';
        applicantStatus.className = 'status-box error';
      }
      return;
    }

    window.HR_PORTAL_SYNC?.beginOptimisticUpdate?.('portal-applicant-form', values.email || 'pending-applicant', values, 'Submitting application...');

    try {
      await window.HR_PORTAL_SHEETS.request(getSheet1Url(), {
        method: 'POST',
        body: JSON.stringify({ action: 'applicant-save', applicant: values })
      });

      window.HR_PORTAL_SYNC?.resolveOptimisticUpdate?.('portal-applicant-form', 'Application submitted successfully.');
      applicantForm.reset();
      if (applicantStatus) {
        applicantStatus.textContent = 'Application submitted successfully. HR will review your details soon.';
        applicantStatus.className = 'status-box success';
      }
    } catch (error) {
      window.HR_PORTAL_SYNC?.rejectOptimisticUpdate?.('portal-applicant-form', error.message || 'Could not submit applicant form. Please try again.');
      if (applicantStatus) {
        applicantStatus.textContent = error.message || 'Could not submit applicant form. Please try again.';
        applicantStatus.className = 'status-box error';
      }
    }
  });
}

const applicantResetBtn = document.getElementById('applicantResetBtn');
if (applicantResetBtn) {
  applicantResetBtn.addEventListener('click', () => {
    if (applicantForm) applicantForm.reset();
    const applicantStatus = document.getElementById('applicantStatusMessage');
    if (applicantStatus) {
      applicantStatus.textContent = '';
      applicantStatus.className = 'status-box hidden';
    }
  });
}