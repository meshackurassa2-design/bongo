const fs = require('fs');
const path = require('path');

const directories = ['app', 'components'];
const targetStr = ' showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}';

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    
    if (content.includes(targetStr)) {
        // Just remove the exact string we injected!
        let newContent = content.split(targetStr).join('');
        fs.writeFileSync(filepath, newContent, 'utf8');
        console.log(`Reverted: ${filepath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

for (const d of directories) {
    if (fs.existsSync(d)) walkDir(d);
}

console.log("Done");
