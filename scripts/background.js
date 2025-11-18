console.log("hi from worker");


let startTime = null;
let curTab = null;
let curWindow = null;
let audibleTabs = null;


async function updateAudibleTabs() {
	audibleTabs = (await chrome.tabs.query({ audible: true })).map(tab => ({"id": tab.id, "url": tab.url}));
	console.log(audibleTabs);
}
updateAudibleTabs();


// track window focus
browser.windows.onFocusChanged.addListener((windowId) => {
	curWindow = windowId;

	console.log(curWindow);
});


// track tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	const tab = await chrome.tabs.get(activeInfo.tabId);
	console.log(tab.url);

	if (curTab) {
		const timeSpent = Date.now() - startTime;
		console.log(timeSpent);
	}

	curTab = tab;
	startTime = Date.now();

	console.log(startTime);
});
