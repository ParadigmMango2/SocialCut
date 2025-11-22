const audibleTabs = new Map();
const curTabLock = "cur_tab";



// ======================================================================
// Utility Functions
// ======================================================================

function getDomain(url) {
	return url.match("\/\/(.*?)(\/|$)")?.[1];
}


async function getActiveTab() {
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	return tab;
}


async function getCurrentWindow() {
	const windows = await chrome.windows.getAll();
	const focusedWindow = windows.find(w => w.focused);

	if (!focusedWindow) {
		return chrome.windows.WINDOW_ID_NONE;
	} else {
		return focusedWindow.id;
	}
}


async function setCurTab(tab) {
	// Only store needed data for privacy
	const curTabVal = {
		"id": tab.id,
		"domain": getDomain(tab.url),
		"startTime": Date.now()
	}

	await navigator.locks.request(curTabLock, async (lock) => {
		await chrome.storage.local.set({ curTab: curTabVal });
	});
}


async function getCurTab() {
	return await navigator.locks.request(curTabLock, async (lock) => {
		const { curTab } = await chrome.storage.local.get("curTab");
		return curTab;
	});
}


async function resetCurTab() {
	await navigator.locks.request(curTabLock, async (lock) => {
		await chrome.storage.local.set({ curTab: null });
	});
}



// ======================================================================
// Init Logic
// ======================================================================

async function init() {
	curWindow = await getCurrentWindow();

	const tab = await getActiveTab();
	if (curWindow !== chrome.windows.WINDOW_ID_NONE) {
		await setCurTab(tab);
	} else {
		await resetCurTab();
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



// ======================================================================
// Current Tab Tracking
// ======================================================================

async function startTracking(tab) {
	await setCurTab(tab);

	setCurTab(tab);

	// console.log(await getCurTab());
}


async function stopTracking() {
	const curTab = await getCurTab();

	const domain = curTab["domain"];
	const timeListened = Date.now() - curTab["startTime"];

	await resetCurTab();

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

	if (await getCurTab()) {
		await stopTracking();
	}

	await startTracking(tab);

	// console.log("Active changed")
	// console.log(tab);
}
chrome.tabs.onActivated.addListener(handleTabActivation);


async function handleUrl(tabId, changeInfo, tab) {
	// console.log(changeInfo);
	// console.log(tab);

	if (await getCurTab()) {
		await stopTracking();
	}

	await startTracking(tab);
}
const urlFilter = {
	properties: ["url"]
};
chrome.tabs.onUpdated.addListener(handleUrl, urlFilter);


async function handleWindow(windowId) {
	const curWindow = windowId;
	// console.log("Cur window:" + curWindow);

	if (await getCurTab()) {
		await stopTracking();
	}

	if (curWindow !== chrome.windows.WINDOW_ID_NONE) {
		const tab = await getActiveTab();
		await startTracking(tab);
	}
}
chrome.windows.onFocusChanged.addListener(handleWindow);



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
// Periodically Update Tracking
// ======================================================================




// ======================================================================
// Suspend Logic
// ======================================================================

async function handleSuspend() {
	console.log("Extension suspending")

	if (await getCurTab()) {
		await stopTracking();
	}

	await resetCurTab();
}
chrome.runtime.onSuspend.addListener(handleSuspend);
