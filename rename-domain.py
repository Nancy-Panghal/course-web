import re, os

REPLACEMENTS = [
    (re.compile(r'Kurso'), 'Kurso'),
    (re.compile(r'KURSO'), 'KURSO'),
]

SKIP_SUBSTR = ['package-lock.json']

changed = []
for dirpath, dirnames, filenames in os.walk('.'):
    dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules', '.next')]
    for fn in filenames:
        path = os.path.normpath(os.path.join(dirpath, fn)).replace('\\', '/')
        if not path or any(s in path for s in SKIP_SUBSTR):
            continue
        try:
            with open(path, encoding='utf-8') as f:
                content = f.read()
        except (UnicodeDecodeError, IsADirectoryError):
            continue
        original = content
        for pattern, repl in REPLACEMENTS:
            content = pattern.sub(repl, content)
        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            changed.append(path)

print(f"Modified {len(changed)} files:")
for p in changed:
    print(" ", p)