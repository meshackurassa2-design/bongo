const fs = require('fs');
const filepath = 'node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt';
const lines = fs.readFileSync(filepath, 'utf-8').split('\n');

let out = [];
let in_method = false;
let brace_depth = 0;

for (let line of lines) {
    if (line.includes(") = scope.launch {")) {
        line = line.replace(") = scope.launch {", ") { scope.launch {");
        in_method = true;
        brace_depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        out.push(line);
    } else if (in_method) {
        brace_depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        out.push(line);
        if (brace_depth === 1 && line.trim().startsWith("}")) {
            out.push("    }");
            in_method = false;
        }
    } else {
        out.push(line);
    }
}

fs.writeFileSync(filepath, out.join('\n'), 'utf-8');
