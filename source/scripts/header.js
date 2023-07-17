let mainNav = document.querySelector(`.main-nav`)
let mainHeader = document.querySelector(`.main-header`)

let prevScrollPos = window.scrollY

export function getHeaderBlockSize () {
	document.documentElement.style.setProperty(`--header-block-size`, `${mainNav.offsetHeight + mainHeader.offsetHeight}px`)
}

export function toggleMainHeaderView () {
	return () => {
		const currentScrollPos = window.scrollY

		mainHeader.style.setProperty(`--is-page-scrolled`, currentScrollPos > 0 ? 1 : 0)
		mainNav.style.setProperty(`--main-nav_is-hidden`, prevScrollPos > currentScrollPos ? 0 : 1)

		prevScrollPos = currentScrollPos
	}
}
