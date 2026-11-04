import fs from 'fs';
let content = fs.readFileSync('src/data/solvents.ts', 'utf-8');

// Replace isEmpty(updated.ehsScore) check with always syncing if ref has it
content = content.replace(
  /if \(isEmpty\(updated.ehsScore\) && !isEmpty\(ref.ehsScore\)\) \{/g,
  'if (!isEmpty(ref.ehsScore) && updated.ehsScore !== ref.ehsScore) {'
);

content = content.replace(
  /if \(isEmpty\(updated.ichClass\) && !isEmpty\(ref.ichClass\)\) \{/g,
  'if (!isEmpty(ref.ichClass) && updated.ichClass !== ref.ichClass) {'
);

// We should also clear it if ref is empty but updated has it (for Water ICH class)
content = content.replace(
  /if \(!isEmpty\(ref.ichClass\) && updated.ichClass !== ref.ichClass\) \{/,
  'if (updated.ichClass !== ref.ichClass) {'
);

fs.writeFileSync('src/data/solvents.ts', content);
console.log('Fixed sync logic');
