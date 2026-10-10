const fs = require('fs');
const path = require('path');

const clientSrc = path.join(__dirname, 'client', 'src', 'components');

const files = fs.readdirSync(clientSrc).filter(f => f.endsWith('.jsx'));

for (const file of files) {
  const filePath = path.join(clientSrc, file);
  let content = fs.readFileSync(filePath, 'utf8');

  let changed = false;

  if (content.includes('api.dicebear.com')) {
    // Regex matches dicebear string literals and template literals
    // e.g. `https://api.dicebear.com/7.x/bottts/svg?seed=${f.user?.username}` -> generateAvatar(f.user?.username)
    // e.g. 'https://api.dicebear.com/7.x/bottts/svg?seed=me' -> generateAvatar('me')
    // e.g. 'https://api.dicebear.com/7.x/pixel-art/svg?seed=HeroX' -> generateAvatar('HeroX')
    
    content = content.replace(/`https:\/\/api\.dicebear\.com\/7\.x\/[a-z-]+\/svg\?seed=\$\{([^}]+)\}`/g, 'generateAvatar($1)');
    content = content.replace(/'https:\/\/api\.dicebear\.com\/7\.x\/[a-z-]+\/svg\?seed=([^']+)'/g, 'generateAvatar(\'$1\')');
    
    // Some lines might be concatenations like 'https://api...seed=' + currentUser?.username
    content = content.replace(/'https:\/\/api\.dicebear\.com\/7\.x\/[a-z-]+\/svg\?seed=' \+ ([^}\n]+)/g, 'generateAvatar($1)');

    if (!content.includes("import { generateAvatar }")) {
      // add import after the last import
      const importLines = content.match(/import [^;]+;/g) || [];
      if (importLines.length > 0) {
        content = content.replace(/(import [^;]+;\n)(?!import)/, `$1import { generateAvatar } from '../utils/avatar';\n`);
      } else {
        content = `import { generateAvatar } from '../utils/avatar';\n` + content;
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Patched', file);
  }
}
