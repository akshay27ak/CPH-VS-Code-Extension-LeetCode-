const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 30002;

app.use(cors()); 
app.use(express.json());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.post('/fetch-testcases-cpp', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('div.view-lines');

        const code = await page.evaluate(() => {
            const lines = document.querySelectorAll('div.view-lines .view-line');

            return Array.from(lines)
                .map(line => {
                    return Array.from(line.children)
                        .map(span => span.textContent)
                        .join('');
                })
                .join('\n') 
                .replace(/\u00A0/g, ' ') 
                .trim(); 
        });

        const solutionPath = path.join(__dirname, 'solution.cpp');
        fs.writeFileSync(solutionPath, code, 'utf8');

        await page.waitForSelector('div.elfjS');

        const html = await page.content();
        
        const $ = cheerio.load(html);

        const examples = extractExamples($, 'cpp');

        if (examples.length === 0) {
            return res.status(404).json({ message: 'No test cases found.' });
        }

        const dirPath = path.join(__dirname, 'testcases');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        } else {
            fs.readdirSync(dirPath).forEach(file => {
                fs.unlinkSync(path.join(dirPath, file));
            });
        }

        examples.forEach((example, index) => {
            const inputFileName = `input_${index + 1}.txt`;
            const outputFileName = `output_${index + 1}.txt`;

            const inputFilePath = path.join(dirPath, inputFileName);
            const outputFilePath = path.join(dirPath, outputFileName);

            fs.writeFileSync(inputFilePath, example.input);
            fs.writeFileSync(outputFilePath, example.output);
        });

        await browser.close();
        res.json(examples);

    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
});

app.post('/fetch-testcases-python', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('#headlessui-popover-button-\\:r1v\\: > div > button');
        await page.click('#headlessui-popover-button-\\:r1v\\: > div > button');
        await page.waitForSelector('#headlessui-popover-panel-\\:r29\\: > div > div > div\:nth-child(1) > div\:nth-child(3)');
        await page.click('#headlessui-popover-panel-\\:r29\\: > div > div > div\:nth-child(1) > div\:nth-child(3)');
        await delay(1000);
        const code = await page.evaluate(() => {
            const lines = document.querySelectorAll('div.view-lines .view-line');

            return Array.from(lines)
                .map(line => {
                    return Array.from(line.children)
                        .map(span => span.textContent)
                        .join('');
                })
                .join('\n') 
                .replace(/\u00A0/g, ' ') 
                .trim(); 
        });

        const solutionPath = path.join(__dirname, 'solution.py');
        fs.writeFileSync(solutionPath, code, 'utf8');

        await page.waitForSelector('div.elfjS');

        const html = await page.content();
        
        const $ = cheerio.load(html);

        const examples = extractExamples($, 'py');

        if (examples.length === 0) {
            return res.status(404).json({ message: 'No test cases found.' });
        }

        const dirPath = path.join(__dirname, 'testcases');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        } else {
            fs.readdirSync(dirPath).forEach(file => {
                fs.unlinkSync(path.join(dirPath, file));
            });
        }

        examples.forEach((example, index) => {
            const inputFileName = `input_${index + 1}.txt`;
            const outputFileName = `output_${index + 1}.txt`;

            const inputFilePath = path.join(dirPath, inputFileName);
            const outputFilePath = path.join(dirPath, outputFileName);

            fs.writeFileSync(inputFilePath, example.input);
            fs.writeFileSync(outputFilePath, example.output);
        });

        await browser.close();
        res.json(examples);

    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
});

function extractExamples($, lang) {
    const examples = [];
    
    $('pre').each((_, elem) => {
        let inputOutput = $(elem).text().trim();
    
        const explanationIndex = inputOutput.indexOf('Explanation');
        if (explanationIndex !== -1) {
            inputOutput = inputOutput.slice(0, explanationIndex).trim();
        }
    
        if (inputOutput.includes('Input:') || inputOutput.includes('Output:')) {
            if (lang === 'cpp') {
                inputOutput = inputOutput.replace(/\[/g, '{').replace(/\]/g, '}');
            }
            const [input, output] = parseInputOutput(inputOutput);
            examples.push({ input, output });
        }
    });

    $('div.example-block').each((index, element) => {
        let input = $(element).find('strong:contains("Input:")').next().text().trim();
        let output = $(element).find('strong:contains("Output:")').next().text().trim();

        if (input && output) {
            if (lang === 'cpp') { 
                input = input.replace(/\[/g, '{').replace(/\]/g, '}');
                output = output.replace(/\[/g, '{').replace(/\]/g, '}');
            }
            examples.push({ input, output });
        }
    });
    return examples;
}

function parseInputOutput(inputOutput) {
    const inputRegex = /Input:\s*(.*?)\s*Output:/s;
    const outputRegex = /Output:\s*(.*)/s;

    const inputMatch = inputOutput.match(inputRegex);
    const outputMatch = inputOutput.match(outputRegex);

    const input = inputMatch ? inputMatch[1].trim() : '';
    const output = outputMatch ? outputMatch[1].trim() : '';

    return [input, output];
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
