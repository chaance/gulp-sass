/* eslint-disable jest/no-test-callback */
/* eslint-disable jest/expect-expect */
const should = require('should');
const Vinyl = require('vinyl');
const path = require('path');
const fs = require('fs');
const sass = require('../index');
const rimraf = require('rimraf');
const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const tap = require('gulp-tap');
const globule = require('globule');
const dest = path.join(__dirname, 'results');
const pathname = path.basename(__dirname);

const sassLogError = sass.logError;

beforeEach(() => {
  sass.logError = jest.fn(function() {
    this.emit('end');
  });
});

afterEach(() => {
  sass.logError = sassLogError;
});

const createVinyl = (filename, contents) => {
  const base = path.join(__dirname, 'scss');
  const filePath = path.join(base, filename);

  return new Vinyl({
    cwd: __dirname,
    base,
    path: filePath,
    contents: contents || fs.readFileSync(filePath),
  });
};

const normaliseEOL = str => str.toString('utf8').replace(/\r\n/g, '\n');

describe('test helpers', () => {
  test('should normalise EOL', () => {
    expect(normaliseEOL('foo\r\nbar')).toBe('foo\nbar');
    expect(normaliseEOL('foo\r\nbar')).toBe('foo\nbar');
    expect(normaliseEOL('foo\nbar')).toBe('foo\nbar');
  });
});

describe('gulp-sass -- async compile', () => {
  test('should pass file when it isNull()', done => {
    const stream = sass();
    const emptyFile = {
      isNull: () => true,
    };
    stream.on('data', data => {
      expect(data).toEqual(emptyFile);
      done();
    });
    stream.write(emptyFile);
  });

  test('should emit error when file isStream()', done => {
    const stream = sass();
    const streamFile = {
      isNull: () => false,
      isStream: () => true,
    };
    stream.on('error', err => {
      expect(err.message).toEqual('Streaming not supported');
      done();
    });
    stream.write(streamFile);
  });

  test('should compile an empty sass file', done => {
    const sassFile = createVinyl('empty.scss');
    const stream = sass();
    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);
      expect(path.basename(cssFile.path)).toBe('empty.css');

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'empty.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));
      done();
    });
    stream.write(sassFile);
  });

  test('should compile a single sass file', done => {
    const sassFile = createVinyl('mixins.scss');
    const stream = sass();
    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'mixins.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));
      done();
    });
    stream.write(sassFile);
  });

  test('should compile multiple sass files', done => {
    const files = [createVinyl('mixins.scss'), createVinyl('variables.scss')];
    const stream = sass();
    let mustSee = files.length;
    let expectedPath = path.join('expected', 'mixins.css');

    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);
      if (cssFile.path.indexOf('variables') !== -1) {
        expectedPath = path.join('expected', 'variables.css');
      }

      const actual = fs.readFileSync(
        path.join(__dirname, expectedPath),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));

      mustSee -= 1;
      if (mustSee <= 0) {
        done();
      }
    });

    files.forEach(file => {
      stream.write(file);
    });
  });

  test('should compile files with partials in another folder', done => {
    const sassFile = createVinyl('inheritance.scss');
    const stream = sass();
    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'inheritance.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));
      done();
    });
    stream.write(sassFile);
  });

  test('should emit logError on sass error', done => {
    const errorFile = createVinyl('error.scss');
    const stream = sass();
    stream.on('error', sass.logError);
    stream.on('end', () => {
      expect(sass.logError.mock.calls.length).toBe(1);
      done();
    });
    stream.write(errorFile);
  });

  test('should handle sass errors', done => {
    const errorFile = createVinyl('error.scss');
    const stream = sass();

    stream.on('error', err => {
      // Error must include message body
      expect(
        err.message.indexOf('property "font" must be followed by a \':\'')
      ).not.toBe(-1);

      // Error must include file error occurs in
      expect(err.message.indexOf(pathname, 'scss', 'error.scss')).not.toBe(-1);

      // Error must include line and column error occurs on
      expect(err.message.indexOf('on line 2')).not.toBe(-1);

      // Error must include relativePath property
      expect(err.relativePath).toBe(path.join(pathname, 'scss', 'error.scss'));

      done();
    });
    stream.write(errorFile);
  });

  test('should preserve the original sass error message', done => {
    const errorFile = createVinyl('error.scss');
    const stream = sass();

    stream.on('error', err => {
      // Error must include original error message
      expect(
        err.messageOriginal.indexOf(
          'property "font" must be followed by a \':\''
        )
      ).not.toBe(-1);

      // Error must not format or change the original error message
      expect(err.messageOriginal.indexOf('on line 2')).toBe(-1);
      done();
    });
    stream.write(errorFile);
  });

  test('should compile a single sass file if the file name has been changed in the stream', done => {
    const sassFile = createVinyl('mixins.scss');
    // Transform file name
    sassFile.path = path.join(
      path.join(__dirname, 'scss'),
      'mixin--changed.scss'
    );

    const stream = sass();
    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);
      expect(cssFile.path.split(path.sep).pop()).toBe('mixin--changed.css');

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'mixins.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));
      done();
    });
    stream.write(sassFile);
  });

  test('should preserve changes made in-stream to a Sass file', done => {
    const sassFile = createVinyl('mixins.scss');
    // Transform file name
    sassFile.contents = Buffer.from(
      `/* Added Dynamically */${sassFile.contents.toString()}`
    );

    const stream = sass();
    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'mixins.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(
        `/* Added Dynamically */\n${normaliseEOL(actual)}`
      );
      done();
    });
    stream.write(sassFile);
  });

  test('should work with gulp-sourcemaps', done => {
    const sassFile = createVinyl('inheritance.scss');

    sassFile.sourceMap =
      '{' +
      '"version": 3,' +
      '"file": "scss/subdir/multilevelimport.scss",' +
      '"names": [],' +
      '"mappings": "",' +
      '"sources": [ "scss/subdir/multilevelimport.scss" ],' +
      '"sourcesContent": [ "@import ../inheritance;" ]' +
      '}';

    // Expected sources are relative to file.base
    const expectedSources = [
      'inheritance.scss',
      'includes/_cats.scss',
      'includes/_dogs.sass',
    ];

    const stream = sass();
    stream.on('data', cssFile => {
      should.exist(cssFile.sourceMap);
      expect(cssFile.sourceMap.sources).toEqual(expectedSources);
      done();
    });
    stream.write(sassFile);
  });

  test('should compile a single indented sass file', done => {
    const sassFile = createVinyl('indent.sass');
    const stream = sass();
    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'indent.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));
      done();
    });
    stream.write(sassFile);
  });

  test('should parse files in sass and scss', done => {
    const files = [createVinyl('mixins.scss'), createVinyl('indent.sass')];
    const stream = sass();
    let mustSee = files.length;
    let expectedPath = path.join('expected', 'mixins.css');

    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);
      if (cssFile.path.indexOf('indent') !== -1) {
        expectedPath = path.join('expected', 'indent.css');
      }

      const actual = fs.readFileSync(
        path.join(__dirname, expectedPath),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));

      mustSee -= 1;
      if (mustSee <= 0) {
        done();
      }
    });

    files.forEach(file => {
      stream.write(file);
    });
  });
});

describe('gulp-sass -- sync compile', () => {
  beforeEach(done => {
    rimraf(dest, done);
  });

  test('should pass file when it isNull()', done => {
    const stream = sass.sync();
    const emptyFile = {
      isNull: () => true,
    };
    stream.on('data', data => {
      expect(data).toEqual(emptyFile);
      done();
    });
    stream.write(emptyFile);
  });

  test('should emit error when file isStream()', done => {
    const stream = sass.sync();
    const streamFile = {
      isNull: () => false,
      isStream: () => true,
    };
    stream.on('error', err => {
      expect(err.message).toBe('Streaming not supported');
      done();
    });
    stream.write(streamFile);
  });

  test('should compile a single sass file', done => {
    const sassFile = createVinyl('mixins.scss');
    const stream = sass.sync();
    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'mixins.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));
      done();
    });
    stream.write(sassFile);
  });

  test('should compile multiple sass files', done => {
    const files = [createVinyl('mixins.scss'), createVinyl('variables.scss')];
    const stream = sass.sync();
    let mustSee = files.length;
    let expectedPath = path.join('expected', 'mixins.css');

    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);

      if (cssFile.path.indexOf('variables') !== -1) {
        expectedPath = path.join('expected', 'variables.css');
      }

      const actual = normaliseEOL(
        fs.readFileSync(path.join(__dirname, expectedPath), 'utf8')
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(actual);

      mustSee -= 1;
      if (mustSee <= 0) {
        done();
      }
    });

    files.forEach(file => {
      stream.write(file);
    });
  });

  test('should compile files with partials in another folder', done => {
    const sassFile = createVinyl('inheritance.scss');
    const stream = sass.sync();

    stream.on('data', cssFile => {
      should.exist(cssFile);
      should.exist(cssFile.path);
      should.exist(cssFile.relative);
      should.exist(cssFile.contents);

      const actual = fs.readFileSync(
        path.join(__dirname, 'expected', 'inheritance.css'),
        'utf8'
      );
      expect(String(normaliseEOL(cssFile.contents))).toBe(normaliseEOL(actual));
      done();
    });
    stream.write(sassFile);
  });

  test('should handle sass errors', done => {
    const errorFile = createVinyl('error.scss');
    const stream = sass.sync();

    stream.on('error', err => {
      expect(
        err.message.indexOf('property "font" must be followed by a \':\'')
      ).not.toBe(-1);
      expect(err.relativePath).toBe(path.join(pathname, 'scss', 'error.scss'));
      done();
    });
    stream.write(errorFile);
  });

  test('should emit logError on sass error', done => {
    const errorFile = createVinyl('error.scss');
    const stream = sass.sync();
    stream.on('error', sass.logError);
    stream.on('end', () => {
      expect(sass.logError.mock.calls.length).toBe(1);
      done();
    });
    stream.write(errorFile);
  });

  test('should work with gulp-sourcemaps', done => {
    const sassFile = createVinyl('inheritance.scss');

    // Expected sources are relative to file.base
    const expectedSources = [
      'inheritance.scss',
      'includes/_cats.scss',
      'includes/_dogs.sass',
    ];

    sassFile.sourceMap =
      '{' +
      '"version": 3,' +
      '"file": "scss/subdir/multilevelimport.scss",' +
      '"names": [],' +
      '"mappings": "",' +
      '"sources": [ "scss/subdir/multilevelimport.scss" ],' +
      '"sourcesContent": [ "@import ../inheritance;" ]' +
      '}';

    const stream = sass.sync();
    stream.on('data', cssFile => {
      should.exist(cssFile.sourceMap);
      expect(cssFile.sourceMap.sources).toEqual(expectedSources);
      done();
    });
    stream.write(sassFile);
  });

  test('should work with gulp-sourcemaps and autoprefixer', done => {
    const expectedSourcesBefore = [
      'inheritance.scss',
      'includes/_cats.scss',
      'includes/_dogs.sass',
    ];

    const expectedSourcesAfter = [
      'includes/_cats.scss',
      'includes/_dogs.sass',
      'inheritance.scss',
    ];

    gulp
      .src(path.join(__dirname, 'scss', 'inheritance.scss'))
      .pipe(sourcemaps.init())
      .pipe(sass.sync())
      .pipe(
        tap(file => {
          should.exist(file.sourceMap);
          expect(file.sourceMap.sources).toEqual(expectedSourcesBefore);
        })
      )
      .pipe(postcss([autoprefixer()]))
      .pipe(sourcemaps.write())
      .pipe(
        tap(file => {
          should.exist(file.sourceMap);
          expect(file.sourceMap.sources).toEqual(expectedSourcesAfter);
        })
      )
      .pipe(gulp.dest(dest))
      .on('end', done);
  });

  test('should work with gulp-sourcemaps and a globbed source', done => {
    const globPath = path.join(__dirname, 'scss', 'globbed');
    const files = globule.find(
      path.join(__dirname, 'scss', 'globbed', '**', '*.scss')
    );
    const filesContent = {};

    files.forEach(file => {
      const source = path.normalize(path.relative(globPath, file));
      filesContent[source] = fs.readFileSync(file, 'utf8');
    });

    gulp
      .src(path.join(__dirname, 'scss', 'globbed', '**', '*.scss'))
      .pipe(sourcemaps.init())
      .pipe(sass.sync())
      .pipe(
        tap(file => {
          should.exist(file.sourceMap);
          const actual = normaliseEOL(file.sourceMap.sourcesContent[0]);
          const expected = normaliseEOL(
            filesContent[path.normalize(file.sourceMap.sources[0])]
          );
          expect(actual).toEqual(expected);
        })
      )
      .pipe(gulp.dest(dest))
      .on('end', done);
  });

  test('should work with gulp-sourcemaps and autoprefixer with different file.base', done => {
    const expectedSourcesBefore = [
      'scss/inheritance.scss',
      'scss/includes/_cats.scss',
      'scss/includes/_dogs.sass',
    ];

    const expectedSourcesAfter = [
      'scss/includes/_cats.scss',
      'scss/includes/_dogs.sass',
      'scss/inheritance.scss',
    ];

    gulp
      .src(path.join(__dirname, 'scss', 'inheritance.scss'), { base: pathname })
      .pipe(sourcemaps.init())
      .pipe(sass.sync())
      .pipe(
        tap(file => {
          should.exist(file.sourceMap);
          expect(file.sourceMap.sources).toEqual(expectedSourcesBefore);
        })
      )
      .pipe(postcss([autoprefixer()]))
      .pipe(
        tap(file => {
          should.exist(file.sourceMap);
          expect(file.sourceMap.sources).toEqual(expectedSourcesAfter);
        })
      )
      .pipe(gulp.dest(dest))
      .on('end', done);
  });

  test('should work with empty files', done => {
    gulp
      .src(path.join(__dirname, 'scss', 'empty.scss'))
      .pipe(sass.sync())
      .pipe(gulp.dest(dest))
      .pipe(
        tap(() => {
          try {
            fs.statSync(path.join(__dirname, 'results', 'empty.css'));
          } catch (e) {
            should.fail(false, true, 'Empty file was produced');
          }
        })
      )
      .pipe(gulp.dest(dest))
      .on('end', done);
  });
});
