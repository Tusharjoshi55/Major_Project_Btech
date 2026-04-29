import pdfParse from 'pdf-parse';
console.log('Type of import:', typeof pdfParse);
if (typeof pdfParse === 'function') {
    console.log('It is a function');
} else {
    console.log('Keys:', Object.keys(pdfParse));
}
