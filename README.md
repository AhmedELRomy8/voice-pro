# Voice & Document Tools (أدوات الصوت والمستندات)

A simple, practical, fully functional application for Windows and the web providing local speech-to-text, OCR image-to-text, Word (DOCX) layout recreation, and Excel (XLSX) table extraction.

- **Zero Cloud / Zero Generative AI**: All speech recognition and OCR run 100% locally on-device. No API keys, no subscriptions, no accounts.
- **Privacy First**: Audio recordings, images, and documents never leave your machine.
- **Bilingual Core**: Full Arabic (RTL) and English (LTR) interface, bidirectional text editing, and document formatting.

---

## 1. Features

### 1. Speech to Text (تحويل الصوت إلى نص)
- Genuine local speech recognition using Whisper (WebAssembly multilingual quantized model).
- Audio recorder capturing 16kHz mono audio with live volume levels and duration timer.
- Controls: Start, Pause, Resume, Stop, and Transcribe.
- Options to Append to document or Replace text.
- Direct export to TXT and DOCX.
- Explicit deterministic voice commands (e.g. "احفظ الملف", "ملف جديد", "صدّر وورد", "صدّر إكسل", "انسخ النص", "امسح النص").

### 2. Image to Text (استخراج النص من الصور)
- Local OCR powered by Tesseract WebAssembly with Arabic (`ara`) and English (`eng`) language packs.
- Drag-and-drop or file upload (PNG, JPG, JPEG, WEBP).
- Canvas image editing: 90° clockwise/counter-clockwise rotation, custom crop box, contrast enhancement.
- Reading order preservation and editable text review with confidence scores.

### 3. Image to Word (تحويل الصور إلى وورد)
- **Mode A (Extract text)**: Clean extraction of paragraphs and headings with automatic Arabic RTL and English LTR alignment.
- **Mode B (Recreate layout)**: Reconstructs document structure, headings, alignments, and spacing using OCR bounding boxes.
- Option to embed the original scanned image into Word as a visual reference.

### 4. Image to Excel (تحويل الجداول إلى إكسل)
- Deterministic geometric table detector that analyzes bounding boxes and clusters rows and columns.
- Interactive Data Grid editor: add/delete rows, add/delete columns, edit cell values.
- Safe parsing: never evaluates formulas, protects against formula injection (`'=...`), preserves numbers and leading zeroes.
- Exports to XLSX with native Right-to-Left (RTL) worksheet views for Arabic tables.
- Clear reporting and fallback options when a document is ordinary prose rather than a table.

### 5. Document Management & Offline Storage
- Local persistence in browser IndexedDB (web) and local application storage (Windows).
- Recent documents list with instant search filtering.
- Editor with full Undo / Redo history stack, word/character count, and print styling.

---

## 2. Setup & Development Instructions

### Prerequisites
- Node.js (v18+ or v24+)
- npm (v9+)

### Installation
```bash
# Clone or navigate to the project directory
cd "c:\Users\tamr4\OneDrive\Desktop\VOICE PRO"

# Install dependencies
npm install

# Run the local development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 3. Windows Desktop Build Instructions (Tauri 2)

The application includes a complete Tauri 2 configuration in `src-tauri/`.

### Prerequisites for Building Windows Native App (.exe / .msi)
1. Install Rust via Rustup:
   ```powershell
   winget install Rustlang.Rustup
   ```
2. Ensure Visual Studio C++ Build Tools or MinGW is installed.
3. Build the desktop app:
   ```powershell
   npm run build
   npx tauri build
   ```
The output `.exe` and `.msi` installers will be generated under `src-tauri/target/release/bundle/`.

---

## 4. Offline Setup & Model Download Instructions

### Web / PWA Offline Mode:
1. Open the application once in a modern browser (Chrome, Edge, Firefox, Brave).
2. The Service Worker (`sw.js`) automatically caches the application shell, icons, and scripts.
3. Click on the **Settings (الإعدادات)** button in the top header.
4. Click **Download Models for Offline Use (تنزيل الملفات للعمل دون إنترنت)**:
   - Downloads the Tesseract Arabic and English OCR traineddata files into local browser IndexedDB storage.
   - Downloads the quantized Whisper multilingual speech recognition model (~39 MB) into the local Cache API.
5. Click **Verify Offline Readiness (فحص الجاهزية الآن)** to confirm that offline recognition is ready.
6. Once downloaded, the application works completely offline with no network connection required.

---

## 5. Automated Test Results

The test suite runs with Vitest and tests all core features:

```powershell
npm test
```

### Actual Results (27/27 Passing):
- `tests/audioEncoder.test.ts` (3 tests):
  - RIFF / WAVE header generation, sample rate (16kHz), mono 16-bit format.
  - 1-second 440Hz sine wave PCM data validation.
  - Clamping clipped audio values without integer overflow.
- `tests/voiceCommands.test.ts` (6 tests):
  - Arabic normalization (stripping diacritics/tashkeel, unifying alefs and taa marbuta).
  - English normalization and lowercasing.
  - Arabic deterministic commands ("احفظ الملف", "ملف جديد", "صدّر وورد", "صدّر إكسل", "انسخ النص", "امسح النص", "تراجع", "إعادة").
  - English deterministic commands ("save document", "new document", "export word", "export excel", "copy text", "clear text", "undo", "redo").
  - Rejecting normal conversational text to prevent accidental command triggers.
  - Flagging destructive commands for user confirmation.
- `tests/rtlAndLayout.test.ts` (4 tests):
  - Arabic RTL text detection.
  - English LTR text detection.
  - Mixed Arabic/English document handling.
  - Number and symbol handling.
- `tests/tableDetection.test.ts` (5 tests):
  - 3-row, 3-column table geometric detection from OCR bounding boxes.
  - Low confidence fallback detection for standard paragraph prose.
  - Adding and deleting rows.
  - Adding and deleting columns.
  - Updating cell values.
- `tests/documentExport.test.ts` (5 tests):
  - Valid DOCX binary Blob generation with paragraphs and headings.
  - Valid DOCX binary Blob generation in Mode B (layout recreation).
  - Valid XLSX binary Blob generation with RTL sheet view.
  - Formula injection protection (`=SUM`, `+cmd`, `@HYPERLINK`).
  - Correct number preservation and leading zeroes retention (`'00123'`).
- `tests/storage.test.ts` (4 tests):
  - Saving and retrieving documents (newest first).
  - Retrieving individual documents by ID.
  - Searching and filtering documents by title and content.
  - Deleting documents and clearing storage.

---

## 6. Known Limitations & Technical Details

1. **Table Detection**:
   - Designed for printed tables with visible grid alignment or clean columnar whitespace.
   - Handwritten tables or tables with heavily distorted camera angles may require manual cell correction in the built-in Data Grid editor.
2. **Browser Memory & Storage Quota**:
   - The local Whisper model (~39 MB) requires approximately 120–200 MB of RAM during inference in WebAssembly.
   - On browsers with strict storage restrictions (e.g. private/incognito windows), cached models may be purged when the window is closed.
3. **Word Document Layout Fidelity**:
   - Mode B reconstructs alignment, headings, paragraph spacing, and tables deterministically using OCR bounding boxes. It does not promise pixel-perfect vector reproduction of complex desktop-publishing magazines; for difficult layouts, use the built-in "Embed original image as visual reference" option.

---

## 7. Estimated Sizes

- **Web / PWA Application Shell**: ~1.1 MB (gzipped: ~330 KB)
- **Tesseract OCR Engine + Arabic & English Data**: ~24 MB (cached in IndexedDB)
- **Whisper Speech Recognition Model (Tiny Quantized)**: ~39 MB (cached in Cache API)
- **Windows Desktop Installer (Tauri 2)**: ~12–18 MB (.msi / .exe)

---

## 8. Confirmation of Operations Working Without Internet

| Operation | Works Without Internet? | Notes |
| :--- | :---: | :--- |
| Application startup | **YES** | Cached via Service Worker (Web) or local binary (Windows) |
| Speech-to-Text recording & transcription | **YES** | 100% local WebAssembly Whisper model |
| OCR image text extraction | **YES** | 100% local Tesseract WebAssembly worker |
| Image rotation, crop & contrast | **YES** | Pure HTML5 Canvas manipulation |
| Table detection & grid editing | **YES** | Pure deterministic geometric algorithm |
| DOCX generation & download | **YES** | Native client-side `docx` generation |
| XLSX generation & download | **YES** | Native client-side `xlsx` generation |
| Document storage & search | **YES** | Local IndexedDB / LocalStorage |
