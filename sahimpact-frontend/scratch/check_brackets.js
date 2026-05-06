
import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\akamr\\projects\\SahimPact\\sahimpact-frontend\\src\\pages\\SystemConfig.jsx', 'utf8');

function checkBalanced(text) {
    let stack = [];
    let lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        for (let j = 0; j < line.length; j++) {
            let char = line[j];
            if (char === '{' || char === '(' || char === '<') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === '>') {
                let last = stack.pop();
                if (!last) {
                    console.log(`Unmatched ${char} at line ${i + 1}, col ${j + 1}`);
                } else if (char === '}' && last.char !== '{') {
                    console.log(`Mismatched } at line ${i + 1}, col ${j + 1} (opened with ${last.char} at line ${last.line})`);
                } else if (char === ')' && last.char !== '(') {
                    console.log(`Mismatched ) at line ${i + 1}, col ${j + 1} (opened with ${last.char} at line ${last.line})`);
                }
                // We skip '>' for now because of the complexity of JSX tags
            }
        }
    }
    while (stack.length > 0) {
        let item = stack.pop();
        if (item.char !== '<') { // Skip JSX tag openings for now
            console.log(`Unclosed ${item.char} from line ${item.line}`);
        }
    }
}

checkBalanced(content);
