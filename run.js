const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

function extractFunction() {
    const solutionPath = path.join(__dirname, "solution.cpp");
    if (!fs.existsSync(solutionPath)) {
        throw new Error("solution.cpp does not exist!");
    }

    const solutionCode = fs.readFileSync(solutionPath, "utf8");

    const publicIndex = solutionCode.indexOf("public:");
    if (publicIndex === -1) {
        throw new Error("Could not find 'public:' in solution.cpp!");
    }

    let functionCode = solutionCode.slice(publicIndex + "public:".length).trim();

    if (functionCode.endsWith("};")) {
        functionCode = functionCode.slice(0, -2).trim();
    }

    return functionCode;
}

function extractVariables(functionCode) {
    const functionSignature = functionCode.split("{")[0].trim();
    const paramsMatch = functionSignature.match(/\(([^)]*)\)/);
    if (!paramsMatch) {
        throw new Error("Failed to extract parameters!");
    }

    return paramsMatch[1].split(",").map((param) => {
        let [type, name] = param.trim().split(/\s+/);
        type = type.replace("&", "").trim();
        return { type, name };
    });
}

function splitInputByVariables(content, variables) {
    const splits = [];
    let regexStr = variables.map(({ name }) => `${name}\\s*=`).join("|");
    const regex = new RegExp(`(${regexStr})`, "g");

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        if (lastIndex !== match.index) {
            splits.push(content.slice(lastIndex, match.index).trim());
        }
        lastIndex = match.index;
    }

    splits.push(content.slice(lastIndex).trim());
    return splits.filter(Boolean);
}

function parseValue(value) {
    value = value.trim();

    if (value.startsWith("{") && value.endsWith("}")) {
        const inner = value.slice(1, -1).trim();
        if (inner.startsWith("{")) {
            return inner
                .split("},")
                .map((v) => parseValue(v + (v.endsWith("}") ? "" : "}")));
        } else {
            return inner.split(",").map((v) => (v.trim()));
        }
    }

    return isNaN(value) ? value : Number(value);
}

function parseInputs(variables) {
    const testcasesPath = path.join(__dirname, "testcases");
    if (!fs.existsSync(testcasesPath)) {
        throw new Error("Testcases folder does not exist!");
    }

    const files = fs.readdirSync(testcasesPath).filter((file) => file.startsWith("input_"));
    const inputs = [];

    files.forEach((file) => {
        const filePath = path.join(testcasesPath, file);
        const content = fs.readFileSync(filePath, "utf8").trim();

        const sections = splitInputByVariables(content, variables);
        const vars = {};

        sections.forEach((section) => {
            const [key, value] = section.split("=").map((s) => s.trim().replace(/,$/, ""));
            vars[key] = parseValue(value);
        });

        inputs.push(vars);
    });

    const mappedInputs = variables.map((v) => inputs.map((input) => input[v.name] || []));
    return { inputs, mappedInputs };
}

function generateDriver() {
    const functionCode = extractFunction();
    const variables = extractVariables(functionCode);
    const { mappedInputs } = parseInputs(variables);

    const functionName = functionCode.split("(")[0].split(" ").pop().trim();
    const returnType = functionCode.split("(")[0].split(" ").slice(0, -1).join(" ").trim();
    const t = mappedInputs[0].length;

    let vectors = `int t = ${t};\nvector<${returnType}> output;\n`;

    variables.forEach(({ type, name }, index) => {
        const array = mappedInputs[index]
            .map((input) =>
                Array.isArray(input)
                    ? `{${input.map((v) => (Array.isArray(v) ? `{${v.join(", ")}}` : v)).join(", ")}}`
                    : input.toString()
            )
            .join(",\n    ");
        vectors += `vector<${type}> t_${name} = {\n    ${array}\n};\n`;
    });

    const mainBody = `
int main() {
    string rootDir = getRootDirectory();
    string outputDir = rootDir + "/outputs";

    createDirectory(outputDir);

    ${vectors.trim()}
    
    for (int i = 0; i < t; i++) {
        string filename = outputDir + "/output_" + to_string(i + 1) + ".txt";
        ofstream outFile(filename);
        if (!outFile.is_open()) {
            cerr << "Error: Could not open file " << filename << endl;
            continue;
        }
            
        ${variables.map((v) => `${v.type} ${v.name} = t_${v.name}[i];`).join("\n        ")}
      
        printLineToFile(outFile, ${functionName}(${variables.map((v) => v.name).join(", ")}));
    }
}`;

    const helperCode = `#include <bits/stdc++.h>
#include <sys/stat.h>  
#include <sys/types.h> 
#include <direct.h>    
#include <unistd.h>    
using namespace std;

string getRootDirectory() {
    char buffer[FILENAME_MAX];
    getcwd(buffer, FILENAME_MAX);
    string currentDir(buffer);
    return currentDir;
}

void clearDirectory(const string& dirName) {
#ifdef _WIN32
    string command = "rmdir /S /Q \\"" + dirName + "\\" && mkdir \\"" + dirName + "\\"";
#else
    string command = "rm -rf \\"" + dirName + "\\" && mkdir -p \\"" + dirName + "\\"";
#endif
    system(command.c_str());
}

void createDirectory(const string& dirName) {
    struct stat info;
    if (stat(dirName.c_str(), &info) == 0 && (info.st_mode & S_IFDIR)) {
        clearDirectory(dirName);
    } else {
#ifdef _WIN32
        _mkdir(dirName.c_str());  
#else
        mkdir(dirName.c_str(), 0777);  
#endif
    }
}

template<typename T>
void printToFile(ofstream& file, const T& value) {
    file << value;
}

template<typename T>
void printToFile(ofstream& file, const vector<T>& vec) {
    file << "{";
    for (size_t i = 0; i < vec.size(); ++i) {
        printToFile(file, vec[i]);
        if (i != vec.size() - 1) file << ", ";
    }
    file << "}";
}

template<typename T>
void printLineToFile(ofstream& file, const T& value) {
    printToFile(file, value);
    file << endl;
}
`;

    const driverCode = `${helperCode}

${functionCode}

${mainBody}`;

    const driverPath = path.join(__dirname, "driver.cpp");
    fs.writeFileSync(driverPath, driverCode, "utf8");
    console.log("driver.cpp generated successfully!");

    return driverPath;
}

function compileAndRun(driverPath) {
    const executablePath = driverPath.replace(".cpp", "");

    exec(`g++ -o "${executablePath}" "${driverPath}"`, (compileErr, stdout, stderr) => {
        if (compileErr) {
            console.error("Compilation Error:", stderr);
            return;
        }
        console.log("Compilation Successful!");

        exec(`"${executablePath}"`, (runErr, runOut, runErrMsg) => {
            if (runErr) {
                console.error("Runtime Error:", runErrMsg);
                return;
            }
            console.log(runOut);
        });
    });
}

try {
    const driverPath = generateDriver();
    compileAndRun(driverPath);
} catch (error) {
    console.error("Error:", error.message);
}
