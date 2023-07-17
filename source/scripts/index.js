import { getHeaderBlockSize, toggleMainHeaderView } from "./header.js"
import { Tabs } from "./tabs.js"

getHeaderBlockSize()

window.addEventListener(`scroll`, toggleMainHeaderView())

window.addEventListener(`load`, () => {
	let tablists = document.querySelectorAll(`[role=tablist]`)
	tablists.forEach((tablist) => { new Tabs(tablist) })
})
