const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'input.txt');
const outputFile = path.join(__dirname, 'input.json');

try {
    const data = fs.readFileSync(inputFile, 'utf8');
    const lines = data.split(/\r?\n/);

    const questions = [];
    let currentQ = null;

    // Regexes
    // Matches "**Question 1**" or "**Question 1 :**" or "**Question 1:** Text"
    const questionStartRegex = /^\*\*\s*Question\s*(\d+)/i;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('#')) continue; // Ignore headers

        const match = line.match(questionStartRegex);
        if (match) {
            if (currentQ) {
                // Validate currentQ
                if (currentQ.question && currentQ.options.length > 0) {
                    questions.push(currentQ);
                }
            }
            
            currentQ = {
                id: parseInt(match[1]),
                question: "",
                options: []
            };

            // Check if the question text is on the same line
            // Example: "**Question 206 :** Text..."
            // Remove the "**Question X..." part to see what remains
            // We strip leading "**Question X" and optional chars like " : " or "**"
            
            // Heuristic: remove the "Question X" part and any surrounding punctuation/bolding
            let textAfterHeader = line.replace(/^\*\*\s*Question\s*\d+\s*(:|\*\*|: \*\*|\*\* :)?\s*/i, '');
            
            // Clean up any remaining leading/trailing Markdown markers
            // Sometimes it leaves "** " at the start
            textAfterHeader = textAfterHeader.trim().replace(/^\*\*\s*/, '').replace(/\*\*$/, '');

            if (textAfterHeader.trim().length > 0) {
                currentQ.question = textAfterHeader.trim();
            }

        } else if (currentQ) {
            // Clean the line of ** for type checking
            let cleanLine = line.replace(/\*\*/g, '').trim();

            // Detect options: 
            // - Starts with "- "
            // - Starts with "a) " or "a. " or "A) " or "A. "
            const isOption = /^-\s|^[A-Za-z][\)\.]\s/.test(cleanLine);

            if (isOption) {
                // If it's an option. 
                // Note: User said correct answers are bold "**". 
                // Sometimes the entire line is bold, or just the text.
                // We assume if "**" is present in the line (and it's not just the label), it's correct.
                
                const isCorrect = line.includes('**');
                
                // Remove markers for the final text
                // Remove -
                let text = cleanLine.replace(/^-\s+/, '');
                // Remove A) or A.
                text = text.replace(/^[A-Za-z][\)\.]\s+/, '');

                currentQ.options.push({
                    text: text.trim(),
                    isCorrect: isCorrect
                });
            } else {
                // It's likely the question text continued or a separate question line
                // If we don't have a question text yet, this is it.
                if (!currentQ.question) {
                    currentQ.question = line.replace(/\*\*/g, '').trim();
                } else {
                    // It could be a multi-line question text, append it
                    // But we must be careful not to append junk. 
                    // Assuming subsequent non-option lines before the next question/header are part of the question.
                    // For safety, only append if we haven't seen options yet.
                    if (currentQ.options.length === 0) {
                         currentQ.question += " " + line.replace(/\*\*/g, '').trim();
                    }
                }
            }
        }
    }
    // Push last
    if (currentQ && currentQ.question && currentQ.options.length > 0) {
        questions.push(currentQ);
    }

    const jsonContent = JSON.stringify(questions, null, 2);
    fs.writeFileSync(outputFile, jsonContent);
    
    // Also write to data.js for easier local usage without server
    const jsContent = `const quizData = ${jsonContent};`;
    fs.writeFileSync(path.join(__dirname, 'data.js'), jsContent);
    
    console.log(`Successfully converted ${questions.length} questions to input.json and data.js`);

} catch (err) {
    console.error("Error:", err);
}
