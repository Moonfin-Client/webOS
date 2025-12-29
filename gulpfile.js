/**
 * Moonfin webOS Build System
 * Transpiles ES6+ JavaScript to ES5 for older webOS compatibility
 * 
 * Supported webOS versions:
 *   - webOS 3.x (Chromium 38) - 2016-2017
 *   - webOS 4.x (Chromium 53) - 2018-2019
 *   - webOS 5.x (Chromium 53) - 2020
 *   - webOS 6.x (Chromium 68) - 2021+
 */

import gulp from "gulp";
import { deleteAsync as del } from "del";
import { readFileSync, writeFileSync } from "fs";
import babel from "gulp-babel";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const version = pkg.version;

console.info("Building Moonfin webOS app - version " + version);

function clean() {
   return del(["frontend/js-transpiled/**", "!frontend/js-transpiled"]);
}

// Update app-version.js with current version
function updateVersion(cb) {
   const versionContent = `var APP_VERSION = '${version}';\n`;
   writeFileSync("./frontend/js/app-version.js", versionContent);
   console.info(`Updated app-version.js to version ${version}`);
   cb();
}

function copyNonJsFiles() {
   return gulp
      .src(
         [
            "frontend/*.html",
            "frontend/*.json",
            "frontend/shaka-player.js",
            "frontend/css/**/*",
            "frontend/assets/**/*",
            "frontend/components/**/*",
            "frontend/webOSTVjs-1.2.11/**/*",
         ],
         { base: "frontend", encoding: false }
      )
      .pipe(gulp.dest("frontend-build/"));
}

// Transpile JS files to ES5 for maximum webOS compatibility
function transpileES5() {
   return gulp
      .src("frontend/js/**/*.js", { base: "frontend" })
      .pipe(
         babel({
            presets: [
               [
                  "@babel/preset-env",
                  {
                     targets: {
                        browsers: ["ie >= 11", "safari >= 9", "chrome >= 38"],
                     },
                     modules: false,
                  },
               ],
            ],
         })
      )
      .pipe(gulp.dest("frontend-build/"));
}

function transpileInPlace() {
   return gulp
      .src("frontend/js/**/*.js", { base: "." })
      .pipe(
         babel({
            presets: [
               [
                  "@babel/preset-env",
                  {
                     targets: {
                        browsers: ["ie >= 11", "safari >= 9"],
                     },
                     modules: false,
                  },
               ],
            ],
         })
      )
      .pipe(gulp.dest("."));
}

const buildES5 = gulp.series(clean, updateVersion, gulp.parallel(copyNonJsFiles, transpileES5));
const transpile = gulp.series(updateVersion, transpileInPlace);

// Export tasks
export {
   clean,
   updateVersion,
   copyNonJsFiles,
   transpileES5,
   transpileInPlace,
   buildES5,
   transpile,
};

export default buildES5;
