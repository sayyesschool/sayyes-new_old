import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import gulp from "gulp"
import cached from "gulp-cached"
import remember from "gulp-remember"
import server from "browser-sync"
import plumber from "gulp-plumber"
import twig from "gulp-twig"
import htmlmin from "gulp-htmlmin"
import bemlinter from "gulp-html-bemlinter"
import * as dartSass from "sass"
import gulpSass from "gulp-sass"
import svgo from "gulp-svgmin"
import postcss from "gulp-postcss"
import postUrl from "postcss-url"
import autoprefixer from "autoprefixer"
import csso from "postcss-csso"
import terser from "gulp-terser"
import sharpResponsive from "gulp-sharp-responsive"
import { stacksvg } from "gulp-stacksvg"
import { deleteAsync } from "del"

const { src, dest, watch, series, parallel } = gulp
const sass = gulpSass(dartSass)
const SOURCE_ROOT = `./source/`
const SERVER_ROOT = `./public/`
const DATA_PATH = `${SOURCE_ROOT}data.json`
let isDevelopment = process.env.NODE_ENV !== `production`

function readJsonFile (path) {
	const file = readFileSync(path)
	return JSON.parse(file)
}

export function processMarkup () {
	return src(`${SOURCE_ROOT}views/pages/**/*.twig`)
		.pipe(twig({
			data: { isDevelopment, ...readJsonFile(DATA_PATH) },
		}))
		.pipe(htmlmin({ collapseWhitespace: !isDevelopment }))
		.pipe(dest(SERVER_ROOT))
		.pipe(server.stream())
}

export function lintBem () {
	return src(`${SERVER_ROOT}**/*.html`)
		.pipe(bemlinter())
}

export function processStyles () {
	const { viewports, images } = readJsonFile(DATA_PATH)
	const sassOptions = {
		functions: {
			"getbreakpoint($bp)": (bp) => new dartSass.SassNumber(viewports[bp.dartValue]),
			"getext($name)": (name) => new dartSass.SassString(images[name.dartValue].ext),
			"getmaxdppx($name)": (name) => new dartSass.SassNumber(images[name.dartValue].maxdppx),
			"getviewports($name)": (name) => {
				let vps = images[name.dartValue].sizes.map((size) => size.viewport).reverse()
				return new dartSass.SassList(vps.map((vp) => new dartSass.SassString(vp)))
			},
		},
	}

	return src(`${SOURCE_ROOT}styles/style.scss`, { sourcemaps: isDevelopment })
		.pipe(plumber())
		.pipe(sass(sassOptions).on(`error`, sass.logError))
		.pipe(postcss([
			postUrl({ assetsPath: `../` }),
			autoprefixer(),
			csso(),
		]))
		.pipe(dest(`${SERVER_ROOT}styles`, { sourcemaps: isDevelopment }))
		.pipe(server.stream())
}

export function processScripts () {
	return src(`${SOURCE_ROOT}scripts/**/*.js`)
		.pipe(terser())
		.pipe(dest(`${SERVER_ROOT}scripts`))
		.pipe(server.stream())
}

export function createStack () {
	return src(`${SOURCE_ROOT}icons/**/*.svg`)
		.pipe(cached(`icons`))
		.pipe(remember(`icons`))
		.pipe(svgo())
		.pipe(stacksvg())
		.pipe(dest(`${SERVER_ROOT}icons`))
}

export function optimizeImages () {
	if (!isDevelopment) {
		return src(`${SOURCE_ROOT}assets/images/**/*.{jpg,png}`)
			.pipe(sharpResponsive({
				formats: [
					{},
					{
						format: `webp`,
					},
					{
						format: `avif`,
					},
				],
			}))
			.pipe(dest(`${SERVER_ROOT}assets/images`))
	} else {
		return src(`${SOURCE_ROOT}assets/images/**/*.{jpg,png}`)
			.pipe(cached(`images`))
			.pipe(remember(`images`))
			.pipe(dest(`${SERVER_ROOT}assets/images`))
	}
}

export function copyFonts () {
	let fontsGlogs = readJsonFile(DATA_PATH).fonts.map((font) => `node_modules/@fontsource-variable/${font.family}/files/*{cyrillic,latin}*-wght-*.woff2`)
	return src(fontsGlogs).pipe(dest(`${SERVER_ROOT}assets/fonts`))
}

const ASSETS_PATHS = [
	`${SOURCE_ROOT}*.ico`,
	`${SOURCE_ROOT}*.webmanifest`,
	`${SOURCE_ROOT}assets/favicons/*`,
	`${SOURCE_ROOT}assets/images/**/*.svg`,
]

export function copyAssets () {
	return src(ASSETS_PATHS, { base: `${SOURCE_ROOT}assets` })
		.pipe(cached(`assets`))
		.pipe(remember(`assets`))
		.pipe(dest(SERVER_ROOT))
		.pipe(server.stream())
}

export async function removeBuild () {
	await deleteAsync(SERVER_ROOT)
}

function reloadServer (done) {
	server.reload()
	done()
}

export function startServer () {
	server.init({
		server: {
			baseDir: SERVER_ROOT,
		},
		cors: true,
		notify: false,
		ui: false,
	})

	watch(`${SOURCE_ROOT}views/**/*.twig`, series(processMarkup))
	watch(`${SOURCE_ROOT}styles/**/*.scss`, series(processStyles))
	watch(`${SOURCE_ROOT}scripts/**/*.js`, series(processScripts))
	watch(`${SOURCE_ROOT}icons/**/*.svg`, series(createStack, reloadServer))
		.on(`unlink`, takeOutTheTrash(`icons`))
	watch(`${SOURCE_ROOT}img/**/*.{jpg,png}`, series(optimizeImages, reloadServer))
		.on(`unlink`, takeOutTheTrash(`images`))
	watch(ASSETS_PATHS, series(copyAssets))
		.on(`unlink`, takeOutTheTrash(`assets`))
	watch(`${SOURCE_ROOT}data.json`, parallel(processStyles, processMarkup, optimizeImages))

	function takeOutTheTrash (cacheName) {
		return (filepath) => {
			remember.forget(cacheName, resolve(filepath))
			delete cached.caches[cacheName][resolve(filepath)]
			deleteAsync(`./${filepath}`.replace(SOURCE_ROOT, SERVER_ROOT))
		}
	}
}

export async function compileProject (done) {
	series(
		removeBuild,
		parallel(
			processStyles,
			processMarkup,
			processScripts,
			createStack,
			copyAssets,
			copyFonts,
			optimizeImages,
		),
	)(done)
}
