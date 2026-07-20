const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../app/settings/verify.tsx'),
  path.join(__dirname, '../components/ai/WorkspaceTab.tsx')
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Find all functions that are NOT the default export or the main export, but they return JSX and use 'styles.' or 'COLORS.'
  // Instead of complex regex, let's just inject the hooks into ANY function that takes props and returns JSX, or we can just target them by name.

  if (file.includes('verify.tsx')) {
    content = content.replace(/function ReqItem\([^)]*\)\s*\{/, (match) => {
      return match + `\n  const { COLORS } = useThemeStore();\n  const styles = getStyles(COLORS);`;
    });
  }

  if (file.includes('WorkspaceTab.tsx')) {
    content = content.replace(/function ProjectCard\([^)]*\)\s*\{/, (match) => {
      return match + `\n  const { COLORS } = useThemeStore();\n  const styles = getStyles(COLORS);`;
    });
    content = content.replace(/function EditProjectModal\([^)]*\)\s*\{/, (match) => {
      return match + `\n  const { COLORS } = useThemeStore();\n  const styles = getStyles(COLORS);`;
    });
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed:', file);
}
