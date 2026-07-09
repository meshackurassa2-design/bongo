const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, files);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      files.push(filePath);
    }
  }
  return files;
}

const allFiles = [...getFiles(path.join(__dirname, '../app')), ...getFiles(path.join(__dirname, '../components'))];

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('COLORS')) continue; // Skip files without COLORS

  // 1. Replace import { COLORS } from '../constants'
  // It could be import { COLORS, GENRES } from '../../constants'
  let matched = false;
  content = content.replace(/import\s+\{([^}]*?)\}\s+from\s+['"]((?:\.\.\/)+)constants['"];/g, (match, imports, relativePath) => {
    matched = true;
    const parts = imports.split(',').map(s => s.trim()).filter(Boolean);
    const hasColors = parts.includes('COLORS');
    
    if (!hasColors) return match;

    const otherImports = parts.filter(p => p !== 'COLORS');
    let replacement = `import { useThemeStore } from '${relativePath}store/themeStore';\n`;
    
    if (otherImports.length > 0) {
      replacement += `import { ${otherImports.join(', ')} } from '${relativePath}constants';`;
    }
    return replacement;
  });

  if (!matched && content.includes('COLORS')) {
    // Maybe it imports from constants without destructuring? Or maybe it's in a different format.
    // Let's just manually fix these if there are any.
  }

  // 2. Change StyleSheet.create to getStyles
  const hasStyles = content.includes('const styles = StyleSheet.create');
  if (hasStyles) {
    content = content.replace(/const\s+styles\s*=\s*StyleSheet\.create\(/g, "const getStyles = (COLORS: any) => StyleSheet.create(");
  }

  // 3. Inject useThemeStore into components
  // We look for functional components. Usually 'export default function X' or 'export function X' or 'const X = () =>'
  
  const injection = hasStyles 
    ? `\n  const { COLORS } = useThemeStore();\n  const styles = getStyles(COLORS);` 
    : `\n  const { COLORS } = useThemeStore();`;

  // export default function
  content = content.replace(/(export\s+default\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/g, `$1${injection}`);
  
  // export function
  content = content.replace(/(export\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/g, (match, p1) => {
    if (match.includes('default')) return match; // Already handled
    return `${p1}${injection}`;
  });

  // const Component = () => {
  // Be careful not to match simple arrow functions. Usually components start with uppercase.
  content = content.replace(/(const\s+[A-Z][A-Za-z0-9_]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/g, `$1${injection}`);

  fs.writeFileSync(file, content, 'utf8');
  console.log('Refactored:', file);
}
console.log('Done!');
