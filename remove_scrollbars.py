import os
import re

directories = ['app', 'components']

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    
    # Process ScrollView
    new_content = re.sub(
        r'<ScrollView(?![^>]*showsVerticalScrollIndicator)', 
        r'<ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}', 
        new_content
    )
    
    # Process FlatList
    new_content = re.sub(
        r'<FlatList(?![^>]*showsVerticalScrollIndicator)', 
        r'<FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}', 
        new_content
    )
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

for d in directories:
    for root, _, files in os.walk(d):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))

print("Done")
