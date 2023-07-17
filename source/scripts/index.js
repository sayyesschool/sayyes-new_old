import { Tabs } from "./tabs.js"

window.addEventListener(`load`, () => {
	let tablists = document.querySelectorAll(`[role=tablist]`)
	tablists.forEach((tablist) => { new Tabs(tablist) })
})
