import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import gulp from "gulp"
import cached from "gulp-cached"
import remember from "gulp-remember"
import server from "browser-sync"
import plumber from "gulp-plumber"
import twing from "gulp-twing"
import { TwingEnvironment, TwingLoaderRelativeFilesystem } from "twing"
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
const PATH_TO_SOURCE = `./source/`
const PATH_TO_DIST = `./public/`
const PATH_TO_DATA = `${PATH_TO_SOURCE}data.json`
let isDevelopment = process.env.NODE_ENV !== `production`

function readJsonFile (path) {
	const file = readFileSync(path)
	return JSON.parse(file)
}

function setEnvVar (varName, varValue) {
	if (process.env.CI) {
		const envFilePath = process.env.GITHUB_ENV
		const envFileContent = readFileSync(process.env.GITHUB_ENV, { encoding: `utf8` })
		writeFileSync(envFilePath, `${envFileContent}\n${varName}=${varValue}`)
	}
}

export function processMarkup () {
	const env = new TwingEnvironment(new TwingLoaderRelativeFilesystem())
	const data = { isDevelopment, ...readJsonFile(PATH_TO_DATA) }
	data.site.dir = process.env.CI ? `/${process.env.REPO_NAME}/` : `/`

	return src(`${PATH_TO_SOURCE}views/pages/**/*.twig`)
		.pipe(twing(env, data))
		.pipe(htmlmin({ collapseWhitespace: !isDevelopment }))
		.pipe(dest(PATH_TO_DIST))
		.pipe(server.stream())
}

export function lintBem () {
	return src(`${PATH_TO_DIST}**/*.html`)
		.pipe(bemlinter())
}

export function processStyles () {
	const { viewports, images } = readJsonFile(PATH_TO_DATA)
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

	return src(`${PATH_TO_SOURCE}styles/style.scss`, { sourcemaps: isDevelopment })
		.pipe(plumber())
		.pipe(sass(sassOptions).on(`error`, sass.logError))
		.pipe(postcss([
			postUrl({ assetsPath: `../` }),
			autoprefixer(),
			csso(),
		]))
		.pipe(dest(`${PATH_TO_DIST}styles`, { sourcemaps: isDevelopment }))
		.pipe(server.stream())
}

export function processScripts () {
	return src(`${PATH_TO_SOURCE}scripts/**/*.js`)
		.pipe(terser())
		.pipe(dest(`${PATH_TO_DIST}scripts`))
		.pipe(server.stream())
}

export function createStack () {
	return src(`${PATH_TO_SOURCE}assets/icons/**/*.svg`)
		.pipe(cached(`icons`))
		.pipe(remember(`icons`))
		.pipe(svgo())
		.pipe(stacksvg())
		.pipe(dest(`${PATH_TO_DIST}assets/icons`))
}

export function optimizeImages (done) {
	if (!isDevelopment) {
		return src(`${PATH_TO_SOURCE}assets/images/**/*.{jpg,png}`)
			.pipe(sharpResponsive({
				formats: [
					{
						format: `webp`,
					},
					{
						format: `avif`,
					},
				],
			}))
			.pipe(dest(`${PATH_TO_DIST}assets/images`))
	}
	done()
}

export function copyImages () {
	return src(`${PATH_TO_SOURCE}assets/images/**/*.{jpg,png,svg}`)
		.pipe(cached(`images`))
		.pipe(remember(`images`))
		.pipe(dest(`${PATH_TO_DIST}assets/images`))
}

export function copyFonts () {
	let fontsGlogs = readJsonFile(PATH_TO_DATA).fonts.map((font) => `node_modules/@fontsource${font.isVariable ? `-variable` : ``}/${font.family}/files/*{cyrillic,latin,vietnamese}*-wght-*.woff2`)
	return src(fontsGlogs).pipe(dest(`${PATH_TO_DIST}assets/fonts`))
}

const ASSETS_PATHS = [
	`${PATH_TO_SOURCE}*.ico`,
	`${PATH_TO_SOURCE}*.webmanifest`,
	`${PATH_TO_SOURCE}assets/favicons/*`,
]

export function copyAssets () {
	return src(ASSETS_PATHS, { base: `${PATH_TO_SOURCE}assets` })
		.pipe(cached(`assets`))
		.pipe(remember(`assets`))
		.pipe(dest(PATH_TO_DIST))
		.pipe(server.stream())
}

export async function removeBuild () {
	await deleteAsync(PATH_TO_DIST)
}

function reloadServer (done) {
	server.reload()
	done()
}

export function startServer () {
	server.init({
		server: {
			baseDir: PATH_TO_DIST,
		},
		cors: true,
		notify: false,
		ui: false,
	}, (err, bs) => {
		bs.addMiddleware(`*`, (req, res) => {
			res.write(readFileSync(`${PATH_TO_DIST}404.html`))
			res.end()
		})
	})

	watch(`${PATH_TO_SOURCE}views/**/*.twig`, series(processMarkup))
	watch(`${PATH_TO_SOURCE}styles/**/*.scss`, series(processStyles))
	watch(`${PATH_TO_SOURCE}scripts/**/*.js`, series(processScripts))
	watch(`${PATH_TO_SOURCE}assets/icons/**/*.svg`, series(createStack, reloadServer))
		.on(`unlink`, takeOutTheTrash(`icons`))
	watch(`${PATH_TO_SOURCE}assets/images/**/*.{jpg,png,svg}`, series(copyImages, optimizeImages, reloadServer))
		.on(`unlink`, takeOutTheTrash(`images`))
	watch(ASSETS_PATHS, series(copyAssets))
		.on(`unlink`, takeOutTheTrash(`assets`))
	watch(`${PATH_TO_SOURCE}data.json`, parallel(processStyles, processMarkup, optimizeImages))

	function takeOutTheTrash (cacheName) {
		return (filepath) => {
			remember.forget(cacheName, resolve(filepath))
			delete cached.caches[cacheName][resolve(filepath)]
			deleteAsync(`./${filepath}`.replace(PATH_TO_SOURCE, PATH_TO_DIST))
		}
	}
}

export function compileProject (done) {
	setEnvVar(`PATH_TO_DIST`, PATH_TO_DIST)
	series(
		removeBuild,
		parallel(
			processStyles,
			processMarkup,
			processScripts,
			createStack,
			copyAssets,
			copyImages,
			copyFonts,
			optimizeImages,
		),
	)(done)
}
