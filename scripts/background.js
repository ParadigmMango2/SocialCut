console.log("hi from worker");


let startTime = null;
let curTab = null;
let curWindow = null;
let audibleTabs = null;


async function updateAudibleTabs() {
	audibleTabs = (await chrome.tabs.query({ audible: true })).map(tab => ({"id": tab.id, "url": tab.url, "windowId": tab.windowId }));
	console.log(audibleTabs);
}
updateAudibleTabs();


async function trackTab() {
	const activeTab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true })).map(tab => ({"id": tab.id, "url": tab.url, "windowId": tab.windowId }));

	console.log(activeTab);
}
trackTab();


// track window focus
chrome.windows.onFocusChanged.addListener((windowId) => {
	curWindow = windowId;

	console.log("Cur window:" + curWindow);
});


// track tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	console.log("Tab activated");

	const tab = await chrome.tabs.get(activeInfo.tabId);
	console.log(tab.url);

	trackTab();

	if (curTab) {
		const timeSpent = Date.now() - startTime;
		console.log(timeSpent);
	}

	curTab = tab;
	startTime = Date.now();

	console.log(startTime);
});

function logUpdated(tabId, changeInfo, tab) {
	console.log("Tab updated");
	console.log(tabId);
	console.log(changeInfo);
	console.log(tab);
}

const audibleFilter = {
	properties: ["audible"]
};

chrome.tabs.onUpdated.addListener(logUpdated, audibleFilter);
