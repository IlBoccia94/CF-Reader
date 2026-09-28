const cameraInput = document.getElementById('cameraInput');
const fileInput = document.getElementById('fileInput');
const previewWrap = document.getElementById('previewWrap');
const preview = document.getElementById('preview');
const statusBox = document.getElementById('status');
const statusLabel = document.getElementById('statusLabel');
const statusPercent = document.getElementById('statusPercent');
const progressBar = document.getElementById('progressBar');
const resultBox = document.getElementById('result');
const cfValue = document.getElementById('cfValue');
const validationMessage = document.getElementById('validationMessage');
const copyButton = document.getElementById('copyButton');
const errorBox = document.getElementById('errorBox');
const debugPanel = document.getElementById('debugPanel');
const ocrText = document.getElementById('ocrText');

let currentPreviewUrl = null;
let running = false;

const CF_PATTERN = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

const ODD_VALUES = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23
};

const EVEN_VALUES = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25
};

const LETTER_POSITIONS = new Set([0, 1, 2, 3, 4, 5, 8, 11, 15]);
const NUMERIC_POSITIONS = new Set([6, 7, 9, 10, 12, 13, 14]);

const DIGIT_TO_LETTER = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '5': 'S',
  '6': 'G',
  '8': 'B'
};

const INVALID_NUMERIC_LETTER_TO_DIGIT = {
  O: '0',
  I: '1',
  Z: '2',
  G: '6',
  B: '8'
};

function setStatus(label, progress) {
  statusBox.hidden = false;
  statusLabel.textContent = label;
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  statusPercent.textContent = pct + '%';
  progressBar.style.width = pct + '%';
}

function resetResult() {
  resultBox.hidden = true;
  errorBox.hidden = true;
  debugPanel.hidden = true;
  ocrText.textContent = '';
  cfValue.textContent = '';
  validationMessage.textContent = '';
}

function isValidCodiceFiscale(value) {
  const cf = value.toUpperCase();

  if (!CF_PATTERN.test(cf)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 15; i += 1) {
    const char = cf[i];
    const table = i % 2 === 0 ? ODD_VALUES : EVEN_VALUES;
    const valueForChar = table[char];

    if (typeof valueForChar !== 'number') {
      return false;
    }

    sum += valueForChar;
  }

  const expectedControlChar = String.fromCharCode(65 + (sum % 26));
  return expectedControlChar === cf[15];
}

function fixLikelyOcrConfusions(value) {
  const chars = value.toUpperCase().split('');

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];

    if (LETTER_POSITIONS.has(i) && DIGIT_TO_LETTER[char]) {
      chars[i] = DIGIT_TO_LETTER[char];
      continue;
    }

    if (NUMERIC_POSITIONS.has(i) && INVALID_NUMERIC_LETTER_TO_DIGIT[char]) {
      chars[i] = INVALID_NUMERIC_LETTER_TO_DIGIT[char];
    }
  }

  return chars.join('');
}

function extractCandidates(text) {
  const candidates = [];
  const seen = new Set();

  function inspectSequence(sequence) {
    const cleaned = sequence.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length < 16) {
      return;
    }

    for (let i = 0; i <= cleaned.length - 16; i += 1) {
      const raw = cleaned.slice(i, i + 16);
      const corrected = fixLikelyOcrConfusions(raw);

      for (const candidate of [raw, corrected]) {
        if (!seen.has(candidate) && isValidCodiceFiscale(candidate)) {
          seen.add(candidate);
          candidates.push(candidate);
        }
      }
    }
  }

  text.split(/\r?\n/).forEach(inspectSequence);

  const chunks = text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  chunks.forEach(inspectSequence);

  // Ultimo tentativo: utile quando l'OCR inserisce spazi tra i caratteri.
  inspectSequence(text);

  return candidates;
}

async function loadImage(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function preprocessForOcr(file) {
  const image = await loadImage(file);
  const maxDimension = 2400;
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  ctx.filter = 'grayscale(1) contrast(1.35)';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.94);
}

function updateTesseractProgress(message) {
  if (!message || typeof message !== 'object') {
    return;
  }

  const progress = typeof message.progress === 'number' ? message.progress : 0;

  const labels = {
    'loading tesseract core': 'Caricamento motore OCR…',
    'initializing tesseract': 'Inizializzazione OCR…',
    'loading language traineddata': 'Caricamento modello OCR…',
    'initializing api': 'Preparazione riconoscimento…',
    'recognizing text': 'Lettura del documento…'
  };

  const label = labels[message.status] || 'Analisi immagine…';
  setStatus(label, progress);
}

async function processImage(file) {
  if (running || !file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    showError('Il file selezionato non è un’immagine.');
    return;
  }

  running = true;
  resetResult();
  setStatus('Preparazione immagine…', 0.02);

  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
  }

  currentPreviewUrl = URL.createObjectURL(file);
  preview.src = currentPreviewUrl;
  previewWrap.hidden = false;

  try {
    if (!window.Tesseract) {
      throw new Error('Tesseract.js non disponibile');
    }

    const preparedImage = await preprocessForOcr(file);
    setStatus('Avvio OCR…', 0.05);

    const recognition = await Tesseract.recognize(preparedImage, 'eng', {
      logger: updateTesseractProgress
    });

    const text = recognition.data.text || '';
    const candidates = extractCandidates(text);

    ocrText.textContent = text.trim() || '(nessun testo riconosciuto)';
    debugPanel.hidden = false;

    if (candidates.length === 0) {
      errorBox.hidden = false;
      setStatus('Analisi completata', 1);
      return;
    }

    const cf = candidates[0];
    cfValue.textContent = cf;
    validationMessage.textContent = candidates.length === 1
      ? 'Struttura e carattere di controllo validi.'
      : 'Rilevati ' + candidates.length + ' codici validi. Viene mostrato il primo.';

    resultBox.hidden = false;
    errorBox.hidden = true;
    setStatus('Codice fiscale trovato', 1);
  } catch (error) {
    console.error(error);
    showError('Errore durante l’OCR. Controlla la connessione e riprova con un’altra foto.');
  } finally {
    running = false;
    cameraInput.value = '';
    fileInput.value = '';
  }
}

function showError(message) {
  resetResult();
  errorBox.hidden = false;
  errorBox.querySelector('strong').textContent = 'Impossibile completare la lettura.';
  errorBox.querySelector('p').textContent = message;
  statusBox.hidden = true;
}

cameraInput.addEventListener('change', (event) => {
  processImage(event.target.files && event.target.files[0]);
});

fileInput.addEventListener('change', (event) => {
  processImage(event.target.files && event.target.files[0]);
});

copyButton.addEventListener('click', async () => {
  const value = cfValue.textContent.trim();

  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    copyButton.textContent = 'Copiato';
    window.setTimeout(() => {
      copyButton.textContent = 'Copia';
    }, 1400);
  } catch {
    copyButton.textContent = 'Seleziona';
    const range = document.createRange();
    range.selectNodeContents(cfValue);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
});
