import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, ChildProcess } from 'child_process';

let serverProcess: ChildProcess | null = null;

export function activate(context: vscode.ExtensionContext) {
    const openPanelCommand = vscode.commands.registerCommand('extension.openPanel', () => {
        const panel = vscode.window.createWebviewPanel(
            'testCaseFetcher',
            'LeetCode Test Case Fetcher',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        panel.webview.html = getWebviewContent();

        panel.onDidDispose(() => {
            stopServer();
        });

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'fetchTestCases') {
                const { url, language } = message;

                try {
                    // Choose the API endpoint based on the selected language
                    const endpoint =
                        language === 'CPP' ? '/fetch-testcases-cpp' : '/fetch-testcases-python';

                    const response = await fetch(`http://localhost:30002${endpoint}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ url }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to fetch test cases');
                    }

                    const data = (await response.json()) as { input: string; output: string }[];

                    const testCases = parseTestCases(data);

                    panel.webview.postMessage({
                        command: 'displayTestCases',
                        testCases,
                    });

                    // Open the correct file based on the selected language
                    const filePath =
                        language === 'CPP'
                            ? path.join(context.extensionPath, 'solution.cpp')
                            : path.join(context.extensionPath, 'solution.py');

                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document, { preview: false });
                } catch (error) {
                    if (error instanceof Error) {
                        vscode.window.showErrorMessage('Failed to fetch test cases: ' + error.message);
                    } else {
                        vscode.window.showErrorMessage(
                            'Failed to fetch test cases due to an unknown error.'
                        );
                    }
                }
            } else if (message.command === 'runScript') {
                const { testCases, language } = message; // Get the selected language
                updateTestCasesFolder(testCases, context);

                const outputFolderPath = path.join(context.extensionPath, 'outputs');

                if (fs.existsSync(outputFolderPath)) {
                    const outputFiles = fs.readdirSync(outputFolderPath);
                    outputFiles.forEach((file) => {
                        const filePath = path.join(outputFolderPath, file);
                        fs.unlinkSync(filePath);
                    });
                    console.log('Files inside the outputs folder cleared.');
                }
        
                // Decide which script to run based on the selected language
                const scriptToRun = language === 'CPP' ? 'run.js' : 'runp.js';
                const scriptPath = path.join(context.extensionPath, scriptToRun);

                exec(`node "${scriptPath}"`, { cwd: context.extensionPath }, (error, stdout, stderr) => {
                    if (error) {
                        vscode.window.showErrorMessage(`Error executing ${scriptToRun}: ${error.message}`);
                        console.error('Error details:', stderr);
                        return;
                    }

                    const outputFiles = fs.readdirSync(outputFolderPath);

                    if (outputFiles.length === 0) {
                        vscode.window.showErrorMessage(
                            'There was a compilation error in your code. No output generated.'
                        );
                        return;
                    }
                    vscode.window.showInformationMessage('Code execution completed successfully!');

                    const outputs = outputFiles.map((file) => {
                        const filePath = path.join(outputFolderPath, file);
                        return fs.readFileSync(filePath, 'utf-8').trim();
                    });

                    panel.webview.postMessage({
                        command: 'displayOutputs',
                        outputs,
                    });
                });
            }
        });

        startServer(context);
    });

    context.subscriptions.push(openPanelCommand);
}

function updateTestCasesFolder(testCases: { input: string; output: string }[], context: vscode.ExtensionContext) {
    const testcasesPath = path.join(context.extensionPath, 'testcases');

    if (fs.existsSync(testcasesPath)) {
        fs.rmSync(testcasesPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testcasesPath, { recursive: true });

    testCases.forEach((testCase, index) => {
        const inputPath = path.join(testcasesPath, `input_${index + 1}.txt`);
        const outputPath = path.join(testcasesPath, `output_${index + 1}.txt`);
        fs.writeFileSync(inputPath, testCase.input, 'utf8');
        fs.writeFileSync(outputPath, testCase.output, 'utf8');
    });
}

function startServer(context: vscode.ExtensionContext) {
    if (serverProcess) {
        vscode.window.showInformationMessage('Server is already running.');
        return;
    }

    const serverJsPath = path.join(context.extensionPath, 'server.js');
    serverProcess = exec(`node "${serverJsPath}"`, { cwd: context.extensionPath });

    serverProcess.stdout?.on('data', (data) => {
        console.log(`[Server]: ${data}`);
    });

    serverProcess.stderr?.on('data', (data) => {
        console.error(`[Server Error]: ${data}`);
    });

    serverProcess.on('exit', (code) => {
        console.log(`[Server] exited with code ${code}`);
        serverProcess = null;
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

function parseTestCases(rawTestCases: any[]): { input: string; output: string }[] {
    return rawTestCases.map(({ input, output }) => ({ input, output }));
}

function getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LeetCode Test Case Fetcher</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 10px;
                }
                .form-group {
                    margin-bottom: 10px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                }
                input[type="text"], select {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                button {
                    padding: 10px 20px;
                    background-color: #007BFF;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #0056b3;
                }
                .test-case {
                    margin-bottom: 20px;
                }
                textarea {
                    width: 100%;
                    height: 60px;
                    margin-bottom: 10px;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="form-group">
                <label for="languageSelect">Select Language:</label>
                <select id="languageSelect">
                    <option value="CPP">CPP</option>
                    <option value="Python">Python</option>
                </select>

                <label for="urlInput">Enter LeetCode Problem URL:</label>
                <input type="text" id="urlInput" placeholder="https://leetcode.com/problems/two-sum/" />
                
                <button id="fetchBtn">Fetch Test Cases</button>
                <button id="runScriptBtn">Run Code</button>
            </div>
            <div id="testCasesContainer"></div>
            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('fetchBtn').addEventListener('click', () => {
                    const url = document.getElementById('urlInput').value.trim();
                    const language = document.getElementById('languageSelect').value;

                    if (!url) {
                        alert('Please enter a URL');
                        return;
                    }

                    vscode.postMessage({
                        command: 'fetchTestCases',
                        url,
                        language,
                    });
                });

                document.getElementById('runScriptBtn').addEventListener('click', () => {
                    const language = document.getElementById('languageSelect').value; // Get selected language
                    const testCaseDivs = document.querySelectorAll('.test-case');
                    const testCases = [];

                    testCaseDivs.forEach((div) => {
                        const actualOutputTextArea = div.querySelector('textarea:nth-of-type(3)');
                        if (actualOutputTextArea) {
                            actualOutputTextArea.value = '';
                        }

                        const inputTextArea = div.querySelector('textarea:nth-of-type(1)');
                        const outputTextArea = div.querySelector('textarea:nth-of-type(2)');

                        if (inputTextArea && outputTextArea) {
                            testCases.push({
                                input: inputTextArea.value.trim(),
                                output: outputTextArea.value.trim(),
                            });
                        }
                    });

                    vscode.postMessage({
                        command: 'runScript',
                        testCases,
                        language, // Include selected language in the message
                    });
                });

                window.addEventListener('message', (event) => {
                    const message = event.data;

                    if (message.command === 'displayTestCases') {
                        const testCasesContainer = document.getElementById('testCasesContainer');
                        testCasesContainer.innerHTML = '';

                        message.testCases.forEach((testCase, index) => {
                            const testCaseDiv = document.createElement('div');
                            testCaseDiv.className = 'test-case';

                            const inputLabel = document.createElement('label');
                            inputLabel.textContent = 'Input ' + (index + 1) + ':';
                            testCaseDiv.appendChild(inputLabel);

                            const inputTextArea = document.createElement('textarea');
                            inputTextArea.value = testCase.input;
                            testCaseDiv.appendChild(inputTextArea);

                            const expectedOutputLabel = document.createElement('label');
                            expectedOutputLabel.textContent = 'Expected Output ' + (index + 1) + ':';
                            testCaseDiv.appendChild(expectedOutputLabel);

                            const expectedOutputTextArea = document.createElement('textarea');
                            expectedOutputTextArea.value = testCase.output;
                            testCaseDiv.appendChild(expectedOutputTextArea);

                            const actualOutputLabel = document.createElement('label');
                            actualOutputLabel.textContent = 'Actual Output ' + (index + 1) + ':';
                            testCaseDiv.appendChild(actualOutputLabel);

                            const actualOutputTextArea = document.createElement('textarea');
                            actualOutputTextArea.id = 'output-' + index;
                            testCaseDiv.appendChild(actualOutputTextArea);

                            testCasesContainer.appendChild(testCaseDiv);
                        });
                    }

                    if (message.command === 'displayOutputs') {
                        message.outputs.forEach((output, index) => {
                            const actualOutputTextArea = document.getElementById('output-' + index);
                            if (actualOutputTextArea) {
                                actualOutputTextArea.value = output;
                            }
                        });
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {
    stopServer();
}
