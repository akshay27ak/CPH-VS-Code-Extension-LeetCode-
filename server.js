const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 30002;

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.post('/fetch-testcases-cpp', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Launch Puppeteer in headless mode
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Set the user agent to mimic a real browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Go to the provided URL
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for the code container to load
        await page.waitForSelector('div.view-lines');

        // Extract the default code
        const code = await page.evaluate(() => {
            const lines = document.querySelectorAll('div.view-lines .view-line');

            return Array.from(lines)
                .map(line => {
                    // Extract the text content of all top-level spans in the line
                    return Array.from(line.children)
                        .map(span => span.textContent)
                        .join('');
                })
                .join('\n') // Join all lines with newline characters
                .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
                .trim(); // Trim any leading or trailing whitespace
        });

        // Save the code to solution.cpp
        const solutionPath = path.join(__dirname, 'solution.cpp');
        fs.writeFileSync(solutionPath, code, 'utf8');

        await page.waitForSelector('div.elfjS');

        // Get the page's HTML content
        const html = await page.content();
        
        // Load the HTML content into Cheerio for easier DOM manipulation
        const $ = cheerio.load(html);

        // Extract test cases using your extraction logic
        const examples = extractExamples($, 'cpp');

        if (examples.length === 0) {
            return res.status(404).json({ message: 'No test cases found.' });
        }

        // Create a directory to store the test case files (if not already created)
        const dirPath = path.join(__dirname, 'testcases');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        } else {
            // Empty the testcases folder before adding new files
            fs.readdirSync(dirPath).forEach(file => {
                fs.unlinkSync(path.join(dirPath, file));
            });
        }

        // Save each example's input and output to separate files
        examples.forEach((example, index) => {
            const inputFileName = `input_${index + 1}.txt`;
            const outputFileName = `output_${index + 1}.txt`;

            const inputFilePath = path.join(dirPath, inputFileName);
            const outputFilePath = path.join(dirPath, outputFileName);

            // Write input and output to separate files
            fs.writeFileSync(inputFilePath, example.input);
            fs.writeFileSync(outputFilePath, example.output);
        });

        // Close the browser after extraction
        await browser.close();
        // Send the response
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
        // Launch Puppeteer in headless mode
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Set the user agent to mimic a real browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Go to the provided URL
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for the code container to load
        await page.waitForSelector('#headlessui-popover-button-\\:r1v\\: > div > button');
        await page.click('#headlessui-popover-button-\\:r1v\\: > div > button');
        await page.waitForSelector('#headlessui-popover-panel-\\:r29\\: > div > div > div\:nth-child(1) > div\:nth-child(3)');
        await page.click('#headlessui-popover-panel-\\:r29\\: > div > div > div\:nth-child(1) > div\:nth-child(3)');
        await delay(1000);
        // Extract the default code
        const code = await page.evaluate(() => {
            const lines = document.querySelectorAll('div.view-lines .view-line');

            return Array.from(lines)
                .map(line => {
                    // Extract the text content of all top-level spans in the line
                    return Array.from(line.children)
                        .map(span => span.textContent)
                        .join('');
                })
                .join('\n') // Join all lines with newline characters
                .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
                .trim(); // Trim any leading or trailing whitespace
        });

        // Save the code to solution.cpp
        const solutionPath = path.join(__dirname, 'solution.py');
        fs.writeFileSync(solutionPath, code, 'utf8');

        await page.waitForSelector('div.elfjS');

        // Get the page's HTML content
        const html = await page.content();
        
        // Load the HTML content into Cheerio for easier DOM manipulation
        const $ = cheerio.load(html);

        // Extract test cases using your extraction logic
        const examples = extractExamples($, 'py');

        if (examples.length === 0) {
            return res.status(404).json({ message: 'No test cases found.' });
        }

        // Create a directory to store the test case files (if not already created)
        const dirPath = path.join(__dirname, 'testcases');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        } else {
            // Empty the testcases folder before adding new files
            fs.readdirSync(dirPath).forEach(file => {
                fs.unlinkSync(path.join(dirPath, file));
            });
        }

        // Save each example's input and output to separate files
        examples.forEach((example, index) => {
            const inputFileName = `input_${index + 1}.txt`;
            const outputFileName = `output_${index + 1}.txt`;

            const inputFilePath = path.join(dirPath, inputFileName);
            const outputFilePath = path.join(dirPath, outputFileName);

            // Write input and output to separate files
            fs.writeFileSync(inputFilePath, example.input);
            fs.writeFileSync(outputFilePath, example.output);
        });

        // Close the browser after extraction
        await browser.close();
        // Send the response
        res.json(examples);

    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
});

// Function to extract test cases from HTML using Cheerio
function extractExamples($, lang) {
    const examples = [];
    
    // Detect Format 1: Check for <pre> tags with test cases
    $('pre').each((_, elem) => {
        let inputOutput = $(elem).text().trim();
    
        // Check if the string contains 'Explanation' and trim it
        const explanationIndex = inputOutput.indexOf('Explanation');
        if (explanationIndex !== -1) {
            // Trim everything after the word "Explanation"
            inputOutput = inputOutput.slice(0, explanationIndex).trim();
        }
    
        // Check if the inputOutput contains 'Input:' or 'Output:'
        if (inputOutput.includes('Input:') || inputOutput.includes('Output:')) {
            if (lang === 'cpp') {
                inputOutput = inputOutput.replace(/\[/g, '{').replace(/\]/g, '}');
            }
            const [input, output] = parseInputOutput(inputOutput);
            examples.push({ input, output });
        }
    });

    // Detect Format 2: Check for <div.example-block>
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

// Helper function to parse input and output from the extracted string
function parseInputOutput(inputOutput) {
    const inputRegex = /Input:\s*(.*?)\s*Output:/s;
    const outputRegex = /Output:\s*(.*)/s;

    const inputMatch = inputOutput.match(inputRegex);
    const outputMatch = inputOutput.match(outputRegex);

    const input = inputMatch ? inputMatch[1].trim() : '';
    const output = outputMatch ? outputMatch[1].trim() : '';

    return [input, output];
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
// mvmennvkev
