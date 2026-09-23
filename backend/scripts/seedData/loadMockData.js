const fs = require('fs');
const path = require('path');

// frontend/src/lib/mockData.js is an ES module (`export const ...`) in a
// package with no "type": "module", so plain `require()` can't parse it and
// `import()` would resolve it as CommonJS and fail on the `export` syntax.
// Rather than hand-copy the dataset into the backend (which would drift from
// the frontend over time), this reads the file's source at seed time and
// rewrites only the `export` keyword away, then evaluates it. The file has
// no imports of its own, so this is safe.
const MOCK_DATA_PATH = path.resolve(__dirname, '../../../frontend/src/lib/mockData.js');

function loadMockData() {
  const source = fs.readFileSync(MOCK_DATA_PATH, 'utf8');
  const exportNames = [];
  const commonJsSource = source.replace(/export const (\w+)/g, (match, name) => {
    exportNames.push(name);
    return `const ${name}`;
  });

  if (exportNames.length === 0) {
    throw new Error(`No "export const" declarations found in ${MOCK_DATA_PATH}`);
  }

  const wrapped = `${commonJsSource}\nmodule.exports = { ${exportNames.join(', ')} };`;
  const sandboxModule = { exports: {} };
  const evaluate = new Function('module', 'exports', 'require', '__dirname', '__filename', wrapped);
  evaluate(sandboxModule, sandboxModule.exports, require, path.dirname(MOCK_DATA_PATH), MOCK_DATA_PATH);

  return sandboxModule.exports;
}

module.exports = { loadMockData, MOCK_DATA_PATH };
