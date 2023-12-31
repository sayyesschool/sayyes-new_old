/*
 *   This content is licensed according to the W3C Software License at
 *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
 *
 *   File:   tabs-automatic.js
 *
 *   Desc:   Tablist widget that implements ARIA Authoring Practices
 */


export class Tabs {
	constructor (groupNode) {
		this.tablistNode = groupNode

		this.tabs = []

		this.firstTab = null
		this.lastTab = null

		this.tabs = Array.from(this.tablistNode.querySelectorAll(`[role=tab]`))
		this.tabpanels = []

		for (let i = 0; i < this.tabs.length; i++) {
			let tab = this.tabs[i]
			let tabpanel = document.getElementById(tab.getAttribute(`aria-controls`))

			tab.tabIndex = -1
			tab.setAttribute(`aria-selected`, `false`)
			this.tabpanels.push(tabpanel)

			tab.addEventListener(`keydown`, this.onKeydown.bind(this))
			tab.addEventListener(`click`, this.onClick.bind(this))

			if (!this.firstTab) {
				this.firstTab = tab
			}
			this.lastTab = tab
		}

		this.setSelectedTab(this.firstTab, false)
	}

	setSelectedTab (currentTab, setFocus) {
		if (typeof setFocus !== `boolean`) {
			setFocus = true
		}
		for (let i = 0; i < this.tabs.length; i++) {
			let tab = this.tabs[i]
			if (currentTab === tab) {
				tab.setAttribute(`aria-selected`, `true`)
				tab.removeAttribute(`tabindex`)
				this.tabpanels[i].classList.remove(`tabs__panel_is-hidden`)
				if (setFocus) {
					tab.focus()
				}
			} else {
				tab.setAttribute(`aria-selected`, `false`)
				tab.tabIndex = -1
				this.tabpanels[i].classList.add(`tabs__panel_is-hidden`)
			}
		}
	}

	setSelectedToPreviousTab (currentTab) {
		let index

		if (currentTab === this.firstTab) {
			this.setSelectedTab(this.lastTab)
		} else {
			index = this.tabs.indexOf(currentTab)
			this.setSelectedTab(this.tabs[index - 1])
		}
	}

	setSelectedToNextTab (currentTab) {
		let index

		if (currentTab === this.lastTab) {
			this.setSelectedTab(this.firstTab)
		} else {
			index = this.tabs.indexOf(currentTab)
			this.setSelectedTab(this.tabs[index + 1])
		}
	}

	/* EVENT HANDLERS */

	onKeydown (event) {
		let tgt = event.currentTarget
		let flag = false

		switch (event.key) {
		case `ArrowLeft`:
			this.setSelectedToPreviousTab(tgt)
			flag = true
			break

		case `ArrowRight`:
			this.setSelectedToNextTab(tgt)
			flag = true
			break

		case `Home`:
			this.setSelectedTab(this.firstTab)
			flag = true
			break

		case `End`:
			this.setSelectedTab(this.lastTab)
			flag = true
			break

		default:
			break
		}

		if (flag) {
			event.stopPropagation()
			event.preventDefault()
		}
	}

	onClick (event) {
		this.setSelectedTab(event.currentTarget)
	}
}
