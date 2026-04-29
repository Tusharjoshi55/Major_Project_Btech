import { extractPages } from '../src/services/pdfService.js';
import fs from 'fs';
import path from 'path';

const testFile = 'test.pdf';
// Create a fake PDF-like structure or just any file
fs.writeFileSync(testFile, '%PDF-1.4');

const test = async () => {
    try {
        console.log('Testing extractPages...');
        const pages = await extractPages(testFile);
        console.log('Success! Pages extracted:', pages.length);
    } catch (e) {
        console.error('Failed:', e.message);
    } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    }
};

test();
