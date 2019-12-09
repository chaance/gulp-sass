const eslint = require('eslint');

describe('code style guide', () => {
  test('index.js should follow our lint style guide', () => {
    const cli = new eslint.CLIEngine({ rules: { 'spaced-comment': 0 } });
    const formatter = cli.getFormatter();
    const report = cli.executeOnFiles(['index.js']);

    if (report.errorCount > 0 || report.warningCount > 0) {
      console.log(formatter(report.results));
    }

    expect(report.errorCount).toEqual(0);
    expect(report.warningCount).toEqual(0);
  });

  test('__tests__/main.js should follow our lint style guide', () => {
    const cli = new eslint.CLIEngine();
    const formatter = cli.getFormatter();
    const report = cli.executeOnFiles(['__tests__/main.js']);

    if (report.errorCount > 0 || report.warningCount > 0) {
      console.log(formatter(report.results));
    }

    expect(report.errorCount).toEqual(0);
    expect(report.warningCount).toEqual(0);
  });

  test('__tests__/lint.js should follow our lint style guide', () => {
    const cli = new eslint.CLIEngine({ rules: { 'no-console': 0 } });
    const formatter = cli.getFormatter();
    const report = cli.executeOnFiles(['__tests__/lint.js']);

    if (report.errorCount > 0 || report.warningCount > 0) {
      console.log(formatter(report.results));
    }

    expect(report.errorCount).toEqual(0);
    expect(report.warningCount).toEqual(0);
  });
});
