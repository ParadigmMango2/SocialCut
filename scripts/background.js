let startTime = null;
let curTab = null;
let curWindow = null;

const audibleTabs = new Map();


chrome.storage.local.set({
  totalSiteTimes: {}
});


// function pruneTab(tab) {
//     return {"id": tab.id, "url": tab.url, "windowId": tab.windowId};
// }

// function pruneTabArr(tabArr) {
// 	return tabArr.map(tab => ({"id": tab.id, "url": tab.url, "windowId": tab.windowId }));
// }

function getDomain(url) {
	return url.match("\/\/(.*?)(\/|$)")?.[1];
}


// async function trackTab() {
// 	const activeTab = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
//
// 	console.log(activeTab);
// }
// trackTab();



// // track tab activation
// chrome.tabs.onActivated.addListener(async (activeInfo) => {
// 	console.log("Tab activated");
//
// 	const tab = await chrome.tabs.get(activeInfo.tabId);
// 	console.log(tab.url);
//
// 	trackTab();
//
// 	if (curTab) {
// 		const timeSpent = Date.now() - startTime;
// 		console.log(timeSpent);
// 	}
//
// 	curTab = tab;
// 	startTime = Date.now();
//
// 	console.log(startTime);
// });



// ======================================================================
// Current Tab Tracking
// ======================================================================

async function startTracking(tab) {
	curTab = {
		"id": tab.id,
		"domain": getDomain(tab.url),
		"startTime": Date.now()
	}
}


async function stopTracking() {
	const domain = curTab["domain"];
	const timeListened = Date.now() - curTab["startTime"];

	curTab = null;

	// Update site times
	const { totalSiteTimes } = await chrome.storage.local.get("totalSiteTimes");
	const totalTime = (totalSiteTimes[domain] || 0) + timeListened;
	totalSiteTimes[domain] = totalTime;
	await chrome.storage.local.set({ totalSiteTimes });

	console.log(totalSiteTimes);
}

// NOTE: Look out for active changed when making new window
async function handleTabActivation(activeInfo) {
	const tab = await chrome.tabs.get(activeInfo.tabId);

	if (curTab) {
		stopTracking();
	}

	startTracking(tab);

	console.log("Active changed")
	console.log(tab);
}
chrome.tabs.onActivated.addListener(handleTabActivation);


async function handleUrl(tabId, changeInfo, tab) {
	if (tab.status === "complete") {
		console.log("URL updated");
		console.log(tabId);
		console.log(changeInfo);
		console.log(tab);
	}
}
const urlFilter = {
	properties: ["url"]
};
chrome.tabs.onUpdated.addListener(handleUrl, urlFilter);


async function handleRemoval(tabId, removeInfo) {
	console.log("Tab removed");
	console.log(tabId);
	console.log(removeInfo);
}
chrome.tabs.onRemoved.addListener(handleRemoval);


chrome.windows.onFocusChanged.addListener((windowId) => {
	curWindow = windowId;
	console.log("Cur window:" + curWindow);
});



// ======================================================================
// Audible Tab Tracking
// ======================================================================

async function startTrackingAudible(tabId, tab) {
	audibleTabs.set(
		tabId,
		{
			"domain": getDomain(tab.url),
			"startTime": Date.now()
		}
	);
}


async function stopTrackingAudible(tabId) {
	const domain = audibleTabs.get(tabId)["domain"];
	const timeListened = Date.now() - audibleTabs.get(tabId)["startTime"];

	audibleTabs.delete(tabId);

	// Update site times
	const { totalSiteTimes } = await chrome.storage.local.get("totalSiteTimes");
	const totalTime = (totalSiteTimes[domain] || 0) + timeListened;
	totalSiteTimes[domain] = totalTime;
	await chrome.storage.local.set({ totalSiteTimes });

	// console.log(totalSiteTimes);
}


async function handleAudibleTab(tabId, changeInfo, tab) {
	// console.log(changeInfo);

	if (changeInfo.url && audibleTabs.has(tabId)) {
		stopTrackingAudible(tabId);
		startTrackingAudible(tabId, tab);
	} else if (changeInfo.audible) {
		startTrackingAudible(tabId, tab);
	} else if (!changeInfo.audible && audibleTabs.has(tabId)) {
		stopTrackingAudible(tabId);
	}
}

const audibleFilter = {
	properties: ["audible", "url"]
};

// chrome.tabs.onUpdated.addListener(handleAudibleTab, audibleFilter);



// ======================================================================
// Init Logic
// ======================================================================
async function getCurrentWindow() {
	const windows = await chrome.windows.getAll();
	const focusedWindow = windows.find(w => w.focused);

	if (!focusedWindow) {
		return chrome.windows.WINDOW_ID_NONE;
	} else {
		return focusedWindow.id;
	}
}

async function init() {
	curWindow = await getCurrentWindow();

	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	if (curWindow !== chrome.windows.WINDOW_ID_NONE) {
		curTab = {
			"id": tab.id,
			"domain": getDomain(tab.url),
			"startTime": Date.now()
		}
	}

	// console.log(curWindow);
	// console.log(tab);
	// console.log(curTab);
}

async function handleStartup() {
	console.log("Browser started");
	await init();
}

async function handleInstall(details) {
	console.log("Extension installed: " + details.reason);
	await init();
}

chrome.runtime.onStartup.addListener(handleStartup);
chrome.runtime.onInstalled.addListener(handleInstall);
