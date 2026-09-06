const fs = require('fs');
let code = fs.readFileSync('open-sse/services/freebuff/terminalParser.js', 'utf8');
code = code.replace(
  'const allText = this.collectedLines;',
  'const allText = this.collectedLines;\n    require("fs").writeFileSync("/tmp/collector_dump4.log", allText.join("\\n"));'
);
fs.writeFileSync('open-sse/services/freebuff/terminalParser.js', code);
