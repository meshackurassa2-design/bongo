const fs = require('fs');
const path = require('path');

const directories = ['app', 'components'];

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let newContent = content;

    // We use a regex to find <ScrollView and <FlatList that don't already have showsVerticalScrollIndicator
    // In JS, regex lookbehind/lookahead can be tricky with variable length.
    // Let's just use string replacement on the opening tags if they don't contain it.
    
    // Replace <ScrollView ...>
    newContent = newContent.replace(/<ScrollView([^>]*?)>/g, (match, p1) => {
        if (!p1.includes('showsVerticalScrollIndicator')) {
            return `<ScrollView${p1} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>`;
        }
        return match;
    });

    newContent = newContent.replace(/<FlatList([^>]*?)(\/?)>/g, (match, p1, p2) => {
        if (!p1.includes('showsVerticalScrollIndicator')) {
            return `<FlatList${p1} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}${p2}>`;
        }
        return match;
    });

    if (newContent !== content) {
        fs.writeFileSync(filepath, newContent, 'utf8');
        console.log(`Updated: ${filepath}`);
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
