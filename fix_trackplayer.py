import sys

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    out = []
    in_method = False
    brace_depth = 0
    
    for line in lines:
        if ") = scope.launch {" in line:
            line = line.replace(") = scope.launch {", ") { scope.launch {")
            in_method = True
            brace_depth = line.count('{') - line.count('}')
            out.append(line)
        elif in_method:
            brace_depth += line.count('{') - line.count('}')
            out.append(line)
            if brace_depth == 1 and line.strip().startswith("}"):
                out.append("    }\n")
                in_method = False
        else:
            out.append(line)
            
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(out)

fix_file('node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt')
