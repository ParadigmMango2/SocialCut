console.log("hi from worker");

let startTime = null;
let curTab = null;
let curWindow = null;
const audibleTabs = new Map();


chrome.storage.local.set({
  totalSiteTimes: {}
});


function pruneTab(tab) {
    return {"id": tab.id, "url": tab.url, "windowId": tab.windowId};
}

function pruneTabArr(tabArr) {
	return tabArr.map(tab => ({"id": tab.id, "url": tab.url, "windowId": tab.windowId }));
}

function getDomain(url) {
	return url.match("\/\/(.*?)(\/|$)")?.[1];
}


async function trackTab() {
	const activeTab = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

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

// TODO: add startup play handling
async function handleAudibleTab(tabId, changeInfo, tab) {
	console.log("Tab updated");
	console.log(tabId);
	console.log(changeInfo);
	console.log(tab);

	const domain = getDomain(tab.url);
if (changeInfo.audible) {
		audibleTabs.set(
			tabId,
			{
				"domain": domain,
				"startTime": Date.now()
			}
		);
	} else {
		const timeListened = Date.now() - audibleTabs.get(tabId)["startTime"];
		console.log("Total time listening: " + timeListened);

		audibleTabs.delete(tabId);

		// Update site times
		const { totalSiteTimes } = await chrome.storage.local.get("totalSiteTimes");
		const totalTime = (totalSiteTimes[domain] || 0) + timeListened;
		totalSiteTimes[domain] = totalTime;
		await chrome.storage.local.set({ totalSiteTimes });
		console.log(totalSiteTimes);
	}

	console.log(audibleTabs);
}

const audibleFilter = {
	properties: ["audible"]
};

chrome.tabs.onUpdated.addListener(handleAudibleTab, audibleFilter);
