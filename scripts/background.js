// ======================================================================
// Constants
// ======================================================================
const syncPeriod = 1; // in minutes
const curTabLock = "cur_tab";
const audibleBgTabsLock = "audible_bg_tabs";
const timesLock = "times";
const syncAlarm = "sync_alarm";

const audibleTabs = new Map();



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


async function getAudibleBgTabs() {
	return await navigator.locks.request(audibleBgTabsLock, async (lock) => {
		const { audibleBackgroundTabs: audibleTabsData = {} } = await chrome.storage.local.get("audibleBackgroundTabs");
		const audibleTabsMap = new Map(Object.entries(audibleTabsData));

		// console.log("getAudibleBgTabs called");

		return audibleTabsMap;
	});
}


async function setAubileBgTabs(audibleTabsMap) {
	await navigator.locks.request(audibleBgTabsLock, async (lock) => {
		const newAudibleTabsData = Object.fromEntries(audibleTabsMap);
		await chrome.storage.local.set({ audibleBackgroundTabs: newAudibleTabsData });
	});
}


async function updateAudibleBgTabs(updateFn) {
	await navigator.locks.request(audibleBgTabsLock, async (lock) => {
		const { audibleBackgroundTabs: audibleTabsData = {} } = await chrome.storage.local.get("audibleBackgroundTabs");
		const audibleTabsMap = new Map(Object.entries(audibleTabsData));

		await updateFn(audibleTabsMap);

		const newAudibleTabsData = Object.fromEntries(audibleTabsMap);
		await chrome.storage.local.set({ audibleBackgroundTabs: newAudibleTabsData });
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

	await navigator.locks.request(audibleBgTabsLock, async (lock) => {
		await chrome.storage.local.set({ audibleBackgroundTabs: {} });
	});

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

async function startTrackingActive(tab) {
// 	await navigator.locks.request(audibleBgTabsLock, async (lock) => {
// 		const { audibleBackgroundTabs: audibleTabsData = {} } = await chrome.storage.local.get("audibleBackgroundTabs");
// 		const audibleTabsMap = new Map(Object.entries(audibleTabsData));
//
// 		if (audibleTabsMap.has(tab.id)) {
// 			audibleTabsMap.delete(tab.id);
//
// 		}
// 	});

	await setCurTab(tab);

	// console.log(await getCurTab());
}


async function stopTrackingActive() {
	const curTab = await getCurTab();

	const domain = curTab["domain"];
	const timeListened = Date.now() - curTab["startTime"];

	await resetCurTab();

	// Update site times
	await navigator.locks.request(timesLock, async (lock) => {
		const { totalSiteTimes = {} } = await chrome.storage.local.get("totalSiteTimes");
		const totalTime = (totalSiteTimes[domain] || 0) + timeListened;
		totalSiteTimes[domain] = totalTime;
		await chrome.storage.local.set({ totalSiteTimes });

		console.log(totalSiteTimes);
	});

	const fullTab = await chrome.tabs.get(curTab.id);
	console.log(fullTab.audible);
	console.log(fullTab);
	if (fullTab.audible) {
		await updateAudibleBgTabs(async (audibleTabsMap) => {
			audibleTabsMap.set(String(curTab.id), { domain: curTab.domain, startTime: curTab.startTime});
			console.log(audibleTabsMap);
		});
	}
}


// NOTE: Look out for active changed when making new window
async function handleTabActivation(activeInfo) {
	const tab = await chrome.tabs.get(activeInfo.tabId);

	if (await getCurTab()) {
		await stopTrackingActive();
	}

	await startTrackingActive(tab);

	// console.log("Active changed")
	// console.log(tab);
}
chrome.tabs.onActivated.addListener(handleTabActivation);


async function handleUrl(tabId, changeInfo, tab) {
	// console.log(changeInfo);
	// console.log(tab);

	// cross-platform version of event filter
	if (!changeInfo.url) return;

	if (await getCurTab()) {
		await stopTrackingActive();
	}

	await startTrackingActive(tab);
}
chrome.tabs.onUpdated.addListener(handleUrl);


async function handleWindow(windowId) {
	const curWindow = windowId;
	// console.log("Cur window:" + curWindow);

	if (await getCurTab()) {
		await stopTrackingActive();
	}

	if (curWindow !== chrome.windows.WINDOW_ID_NONE) {
		const tab = await getActiveTab();
		await startTrackingActive(tab);
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
	await navigator.locks.request(timesLock, async (lock) => {
		const { totalSiteTimes = {} } = await chrome.storage.local.get("totalSiteTimes");
		const totalTime = (totalSiteTimes[domain] || 0) + timeListened;
		totalSiteTimes[domain] = totalTime;
		await chrome.storage.local.set({ totalSiteTimes });

		// console.log(totalSiteTimes);
	});
}


async function handleAudibleTab(tabId, changeInfo, tab) {
	// console.log(changeInfo);

	if (!changeInfo.url && !changeInfo.audible) {
		return;
	}

	if (changeInfo.url && audibleTabs.has(tabId)) {
		stopTrackingAudible(tabId);
		startTrackingAudible(tabId, tab);
	} else if (changeInfo.audible) {
		startTrackingAudible(tabId, tab);
	} else if (!changeInfo.audible && audibleTabs.has(tabId)) {
		stopTrackingAudible(tabId);
	}
}

// chrome.tabs.onUpdated.addListener(handleAudibleTab);



// ======================================================================
// Sync Tracking
// ======================================================================

async function handleSync(alarm) {
	if (alarm.name === syncAlarm) {
		console.log("Syncing...");

		const curTab = await getCurTab();

		if (curTab) {
			const tab = await chrome.tabs.get(curTab.id);

			await stopTrackingActive();
			await startTrackingActive(tab);
		}
	}
}
chrome.alarms.create(syncAlarm, { periodInMinutes: syncPeriod });
chrome.alarms.onAlarm.addListener(handleSync);



// ======================================================================
// Suspend Logic
// ======================================================================

async function handleSuspend() {
	console.log("Extension suspending")

	if (await getCurTab()) {
		await stopTrackingActive();
	}

	await resetCurTab();
}
chrome.runtime.onSuspend.addListener(handleSuspend);
