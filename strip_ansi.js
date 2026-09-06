const fs = require('fs');
const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
const content = fs.readFileSync('test_long.log', 'utf8');
const plain = content.replace(ansiRegex, '');
fs.writeFileSync('test_long_plain.log', plain);
