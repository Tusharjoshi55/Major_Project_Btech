import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

console.log('Type:', typeof pdfParse);
if (typeof pdfParse === 'function') {
    console.log('It is a function directly');
} else {
    console.log('Keys:', Object.keys(pdfParse));
    console.log('Type of default:', typeof pdfParse.default);
}
