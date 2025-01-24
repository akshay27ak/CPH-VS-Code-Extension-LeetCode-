const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

function extractFunction() {
    const solutionPath = path.join(__dirname, "solution.py");
    if (!fs.existsSync(solutionPath)) {
        throw new Error("solution.py does not exist!");
    }

    const solutionCode = fs.readFileSync(solutionPath, "utf8");

    const classMatch = solutionCode.match(/class\s+Solution\(object\):\s*def\s+(\w+)\(([^)]*)\)/);
    if (!classMatch) {
        throw new Error("Could not extract the function from solution.py!");
    }

    const functionName = classMatch[1].trim();
    const params = classMatch[2].split(",").map((param) => param.trim()).filter((p) => p !== "self");

    return { functionName, params };
}

function splitInputByVariables(content, variables) {
    const splits = [];
    let regexStr = variables.map((name) => `${name}\\s*=`).join("|");
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

    if (value.startsWith("[") && value.endsWith("]")) {
        return JSON.parse(value.replace(/'/g, '"')); 
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

    return inputs;
}

function generateDriver(functionName, variables, inputs) {
    const driverContent = `
import os
from solution import Solution

def get_root_directory():
    return os.getcwd()

def create_directory(dir_name):
    if os.path.exists(dir_name):
        for file in os.listdir(dir_name):
            file_path = os.path.join(dir_name, file)
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                os.rmdir(file_path)
    else:
        os.makedirs(dir_name)

def save_output(output_dir, outputs):
    for i, output in enumerate(outputs):
        output_file = os.path.join(output_dir, f"output_{i + 1}.txt")
        with open(output_file, "w") as f:
            f.write(str(output))

def main():
    root_dir = get_root_directory()
    output_dir = os.path.join(root_dir, "outputs")
    create_directory(output_dir)
    
    # Hardcoded test cases
    test_cases = ${JSON.stringify(inputs, null, 4)}
    
    # Create a solution instance
    solution = Solution()
    
    # Execute the function for each test case
    outputs = []
    for case in test_cases:
        result = solution.${functionName}(${variables.map((v) => `case["${v}"]`).join(", ")})
        outputs.append(result)
    
    # Save the outputs
    save_output(output_dir, outputs)
    print("Outputs have been saved successfully!")

if __name__ == "__main__":
    main()
    `;

    const driverPath = path.join(__dirname, "driver.py");
    fs.writeFileSync(driverPath, driverContent, "utf8");
    console.log("driver.py generated successfully!");
    return driverPath;
}

function runDriver(driverPath) {
    exec(`python "${driverPath}"`, (err, stdout, stderr) => {
        if (err) {
            console.error("Error executing driver.py:", stderr);
            return;
        }
        console.log(stdout);
    });
}

try {
    const { functionName, params } = extractFunction();
    const testCases = parseInputs(params);
    const driverPath = generateDriver(functionName, params, testCases);
    runDriver(driverPath);
} catch (error) {
    console.error("Error:", error.message);
}
